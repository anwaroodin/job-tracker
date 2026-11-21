import { AiChat02Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Button } from "~/components/ui/button";

const COPIED_MS = 2500;

async function promptText(applicationId: string) {
  const res = await fetch(`/applications/${applicationId}/prompt`);
  if (!res.ok) throw new Error("prompt failed");
  return ((await res.json()) as { prompt: string }).prompt;
}

export function CopyPrompt({ applicationId }: { applicationId: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async () => {
    const text = promptText(applicationId);
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })) })]);
      } else {
        await navigator.clipboard.writeText(await text);
      }
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), COPIED_MS);
  };

  return (
    <Button type="button" variant="ghost" size="tiny" onClick={copy} title="Copies the job description and your CV, ready to paste into ChatGPT, Claude or another AI chat">
      <HugeiconsIcon icon={state === "copied" ? Tick02Icon : AiChat02Icon} size={15} strokeWidth={1.5} />
      {state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy" : "Copy prompt"}
    </Button>
  );
}
