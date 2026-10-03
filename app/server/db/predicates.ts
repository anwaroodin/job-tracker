import { sql, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { APPLICATION_CATEGORIES, DETAIL_CATEGORIES } from "~/lib/email";

type Columns<K extends string> = Record<K, AnySQLiteColumn>;

const list = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(", "));

export const STUB_REFETCH_FOR_THREAD = "thread";

export const isStageEmail = (t: Columns<"category">): SQL => sql`${t.category} not in ('other', 'deleted')`;

export const isUnprunedOther = (t: Columns<"prunedAt" | "category">): SQL =>
  sql`${t.prunedAt} is null and ${t.category} = 'other'`;

export const isStub = (t: Columns<"prunedAt">): SQL => sql`${t.prunedAt} is not null`;

export const isKept = (t: Columns<"prunedAt">): SQL => sql`${t.prunedAt} is null`;

export const awaitsSuggestion = (t: Columns<"suggestionAt" | "category">): SQL =>
  sql`${t.suggestionAt} is null and ${t.category} in (${list(APPLICATION_CATEGORIES)})`;

export const awaitsDetails = (t: Columns<"detailsAt" | "category">): SQL =>
  sql`${t.detailsAt} is null and ${t.category} in (${list(DETAIL_CATEGORIES)})`;

export const hasUpNextDetails = (t: Columns<"eventAt" | "needsReply">): SQL =>
  sql`(${t.eventAt} is not null or ${t.needsReply} is not null)`;

export const isUnreadLink = (t: Columns<"viewedAt" | "dismissedAt">): SQL =>
  sql`${t.viewedAt} is null and ${t.dismissedAt} is null`;
