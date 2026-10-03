import { asBatch } from "../../db/batch.server";
import type { Db } from "../../db/client.server";
import type { NewActivity } from "../../db/queries/activity.server";
import { dismissedSuggestions, emailsNeedingDetails, emailsNeedingSuggestion, updateEmail } from "../../db/queries/email-sync.server";
import { insertUsage, usageRows } from "../../db/queries/usage.server";
import { findDates, findLinks } from "../../email/details.server";
import { extractDetailsWithJev } from "../../jev/email-details.server";
import {
  matchesDismissed,
  MIN_APPLICATION_PROBABILITY,
  suggestionCandidates,
  SUGGESTION_LOOKBACK_MS,
} from "../../email/suggestions.server";
import { suggestApplicationsWithJev, suggestWithoutJev } from "../../jev/application-suggestion.server";
import { NEEDS_REPLY_PROBABILITY } from "~/lib/email";
import { getMessageBodies } from "../client.server";
import type { Run } from "./run";
import { DAY, isRecent } from "./run";

const DETAILS_PER_RUN = 20;
const DETAILS_LOOKBACK_MS = 60 * DAY;
const SUGGESTIONS_PER_RUN = 25;

export async function extractPendingDetails(env: Env, db: Db, run: Run, token: string): Promise<NewActivity[]> {
  const apiKey = env.TYPESAFE_API_KEY;
  if (!apiKey || !run.useJev || !run.settings.extractDetails) return [];
  const since = new Date(Date.now() - DETAILS_LOOKBACK_MS).toISOString();
  const pending = await emailsNeedingDetails(db, run.userId, since, DETAILS_PER_RUN);
  if (!pending.length) return [];

  const bodies = await getMessageBodies(
    token,
    pending.map((e) => e.id),
  );
  const inputs = pending.map((email) => {
    const body = bodies.get(email.id);
    const text = body?.text || email.snippet;
    return {
      id: email.id,
      category: email.category,
      from: `${email.fromName} <${email.fromAddress}>`,
      subject: email.subject,
      text,
      dates: findDates(text, email.receivedAt),
      links: findLinks(body?.links ?? []),
    };
  });
  const { results, usage } = await extractDetailsWithJev(apiKey, inputs);

  const detailsAt = new Date().toISOString();
  const updates = pending.flatMap((email) => {
    const details = results.get(email.id);
    if (!details) return [];
    return [updateEmail(db, run.userId, email.id, { detailsAt, ...details })];
  });
  const inserts = usageRows(run.userId, usage, detailsAt).map((row) => insertUsage(db, row));
  if (updates.length || inserts.length) await db.batch(asBatch([...inserts, ...updates]));

  return pending
    .filter((email) => isRecent(email.receivedAt))
    .flatMap((email): NewActivity[] => {
      const details = results.get(email.id);
      if (!details) return [];
      const base = { applicationId: email.applicationId, emailId: email.id };
      return [
        ...(details.needsReply >= NEEDS_REPLY_PROBABILITY ? [{ ...base, kind: "reply" as const }] : []),
        ...(details.eventAt
          ? [{ ...base, kind: "event" as const, detail: { eventAt: details.eventAt, category: email.category } }]
          : []),
      ];
    });
}

export async function suggestUntrackedApplications(env: Env, db: Db, run: Run, token: string): Promise<NewActivity[]> {
  if (!run.settings.suggestApplications) return [];
  const since = new Date(Date.now() - SUGGESTION_LOOKBACK_MS).toISOString();
  const pending = await emailsNeedingSuggestion(db, run.userId, since, SUGGESTIONS_PER_RUN);
  if (!pending.length) return [];

  const bodies = await getMessageBodies(
    token,
    pending.map((e) => e.id),
  );
  const inputs = pending.map((email) => {
    const source = {
      subject: email.subject,
      fromName: email.fromName,
      fromAddress: email.fromAddress,
      text: bodies.get(email.id)?.text || email.snippet,
      links: bodies.get(email.id)?.links ?? [],
    };
    return {
      id: email.id,
      from: `${email.fromName} <${email.fromAddress}>`,
      subject: email.subject,
      text: source.text,
      ...suggestionCandidates(source),
    };
  });

  const apiKey = env.TYPESAFE_API_KEY;
  const { results, usage } =
    apiKey && run.useJev
      ? await suggestApplicationsWithJev(apiKey, inputs)
      : { results: new Map(inputs.map((input) => [input.id, suggestWithoutJev(input)])), usage: [] };

  const wasDismissed = matchesDismissed(await dismissedSuggestions(db, run.userId, since));
  const dismissed = new Set(
    pending
      .filter((email) => {
        const result = results.get(email.id);
        return wasDismissed({ threadId: email.threadId, company: result?.company ?? null, role: result?.role ?? null });
      })
      .map((email) => email.id),
  );
  const suggestionAt = new Date().toISOString();
  const updates = pending.flatMap((email) => {
    const result = results.get(email.id);
    if (!result) return [];
    return [
      updateEmail(db, run.userId, email.id, {
        suggestionAt,
        isApplication: result.isApplication,
        suggestedCompany: result.company,
        suggestedRole: result.role,
        suggestionConfidence: result.confidence,
        ...(dismissed.has(email.id) ? { suggestionDismissedAt: suggestionAt } : {}),
      }),
    ];
  });
  const inserts = usageRows(run.userId, usage, suggestionAt).map((row) => insertUsage(db, row));
  if (updates.length || inserts.length) await db.batch(asBatch([...inserts, ...updates]));

  return pending
    .filter((email) => isRecent(email.receivedAt))
    .flatMap((email): NewActivity[] => {
      const result = results.get(email.id);
      if (!result || result.isApplication < MIN_APPLICATION_PROBABILITY || dismissed.has(email.id)) return [];
      return [
        {
          kind: "suggestion",
          emailId: email.id,
          detail: { company: result.company, role: result.role, category: email.category },
        },
      ];
    });
}
