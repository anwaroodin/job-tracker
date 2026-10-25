export const SHARE_DAYS = [1, 7, 30] as const;
export const DEFAULT_SHARE_DAYS = 7;

export interface ShareLinkState {
  includeCv: boolean;
  expiresAt: string;
}
