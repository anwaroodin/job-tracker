import { useEffect, useState } from "react";
import { runnerAvailable } from "~/lib/runner";

export type RunnerStatus = "checking" | "ready" | "offline";

export function useRunnerStatus() {
  const [status, setStatus] = useState<RunnerStatus>("checking");
  useEffect(() => {
    runnerAvailable().then((ok) => setStatus(ok ? "ready" : "offline"));
  }, []);
  return status;
}

export function RunnerOffline() {
  return (
    <>
      Start the runner on this computer with <code className="bg-ink/[0.06] px-1 font-mono text-[12.5px] text-text-primary">npm run runner</code>, then reload this page.
    </>
  );
}
