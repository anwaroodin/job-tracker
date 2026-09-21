import { Badge } from "~/components/atoms/badge";

const STATUS_TO_VARIANT: Record<
  string,
  "neutral" | "info" | "success" | "warning" | "error"
> = {
  applied: "info",
  screening: "info",
  interview: "warning",
  offer: "success",
  accepted: "success",
  rejected: "error",
  withdrawn: "neutral",
  ghosted: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_TO_VARIANT[status.toLowerCase()] ?? "neutral";
  return <Badge variant={variant}>{status}</Badge>;
}
