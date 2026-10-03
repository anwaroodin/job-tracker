import { NON_STAGE_CATEGORIES } from "~/lib/status";
import { isConfident } from "../../email/classify/index.server";
import { shouldFollowEmail } from "../../services/status/rules";
import { matchApplication } from "./match.server";
import type { Plan, StoredEmail, TrackedApplication, LatestStage } from "./run";

export function planLinksAndStatuses(
  unlinked: StoredEmail[],
  applications: TrackedApplication[],
  latestStages: LatestStage[],
  minConfidence: number,
): Plan {
  const latestByApplication = new Map(latestStages.map((stage) => [stage.applicationId, stage]));
  const needsStatusCheck = new Set<string>();
  const links: Plan["links"] = [];
  const matchable = applications.filter((app) => app.status !== "saved");

  for (const email of unlinked) {
    const candidates = applicationsStillOpenFor(email, matchable, latestByApplication);
    const match = matchApplication(email, candidates);
    if (!match) continue;

    links.push({ emailId: email.id, applicationId: match.id, category: email.category, receivedAt: email.receivedAt });
    const unsure = !email.manualCategoryAt && !isConfident(email.confidence, minConfidence);
    if (NON_STAGE_CATEGORIES.includes(email.category) || unsure) continue;

    const current = latestByApplication.get(match.id);
    if (!current || email.receivedAt > current.receivedAt) {
      latestByApplication.set(match.id, { applicationId: match.id, category: email.category, receivedAt: email.receivedAt });
    }
    needsStatusCheck.add(match.id);
  }

  const statusChanges = applications.flatMap((app) => {
    const latest = needsStatusCheck.has(app.id) ? latestByApplication.get(app.id) : undefined;
    return latest && shouldFollowEmail(app, latest)
      ? [{ applicationId: app.id, status: latest.category, from: app.status }]
      : [];
  });

  return { links, statusChanges };
}

function applicationsStillOpenFor(
  email: StoredEmail,
  applications: TrackedApplication[],
  latestByApplication: Map<string, LatestStage>,
) {
  if (email.category !== "applied") return applications;
  return applications.filter((app) => {
    const latest = latestByApplication.get(app.id);
    const rejectedBeforeThisEmail = latest?.category === "rejected" && latest.receivedAt < email.receivedAt;
    return !rejectedBeforeThisEmail;
  });
}
