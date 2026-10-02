import { type ActivityItem } from "~/lib/activity";

export const ACTIVITY_URL = "/api/activity";

export type ActivityData = { items: ActivityItem[] };
