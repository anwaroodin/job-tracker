/** "saved" is a bookmarked posting that hasn't been applied to yet. */
export const APPLICATION_STATUSES = [
  "saved",
  "applied",
  "screening",
  "interview",
  "assessment",
  "offer",
  "accepted",
  "rejected",
  "ghosted",
  "withdrawn",
] as const;

export const LOCKED_STATUSES = new Set(["accepted", "withdrawn"]);

export const NON_STAGE_CATEGORIES = ["other", "applied", "deleted"];

export const CLOSED_STATUSES = ["rejected", "withdrawn", "ghosted", "accepted"];

export const ACTIVE_STATUSES = new Set(["applied", "screening", "interview", "assessment"]);

export const OFFER_STATUSES = new Set(["offer", "accepted"]);
