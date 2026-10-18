import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";

export function BackToSaved() {
  const fetcher = useFetcher();
  return (
    <Button
      type="button"
      variant="ghost"
      size="tiny"
      className="uppercase"
      disabled={fetcher.state !== "idle"}
      title="Not applied yet: move it back to your saved jobs"
      onClick={() => fetcher.submit({ intent: "unapply" }, { method: "post" })}
    >
      Back to saved
    </Button>
  );
}
