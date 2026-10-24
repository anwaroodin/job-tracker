import { useNow } from "~/hooks/use-now";
import { cn } from "~/lib/cn";
import { stageIndex, STAGES, type TailoringSession } from "~/lib/state/tailoring";

type CellState = "done" | "run" | "ask" | "wait" | "off";

const MARKS: Record<CellState, string> = { done: "✓", run: "●", ask: "?", wait: "○", off: "–" };
const TONES: Record<CellState, string> = {
  done: "text-green-primary",
  run: "text-accent-primary",
  ask: "text-red-primary",
  wait: "text-text-tertiary",
  off: "text-text-tertiary",
};

function seconds(ms: number) {
  const total = Math.max(1, Math.round(ms / 1000));
  return total < 60 ? `${total}s` : `${Math.floor(total / 60)}m ${total % 60}s`;
}

function cellState(session: TailoringSession, id: string, index: number, current: number): CellState {
  if (id === "letter" && (!session.letter || "roleId" in session.target)) return "off";
  if (session.status === "done") return "done";
  if (session.status === "questions") return id === "plan" ? "ask" : index < current ? "done" : "wait";
  if (id === session.stage) return session.status === "running" ? "run" : "wait";
  return index < current || id in session.durations ? "done" : "wait";
}

export function TailorProgress({ session }: { session: TailoringSession }) {
  const now = useNow(1000);
  const current = stageIndex(session.status === "questions" ? "plan" : session.stage);
  const elapsed = session.stageStartedAt ? now - session.stageStartedAt : 0;

  const message =
    session.status === "running"
      ? `${STAGES[current]?.doing ?? "Starting…"} ${seconds(elapsed)} so far. You can leave this page; it keeps going.`
      : session.status === "queued"
        ? "Queued. It starts when the runner finishes the session ahead of it."
        : session.status === "questions"
          ? `Paused until you answer ${session.questions?.length ?? 0} questions below.`
          : session.status === "failed"
            ? session.error
            : `Done in ${seconds(Object.values(session.durations).reduce((a, b) => a + b, 0))}.`;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-1.5">
        {STAGES.map(({ id, label }, index) => {
          const state = cellState(session, id, index, current);
          const detail =
            state === "run"
              ? "working"
              : state === "ask"
                ? "needs answers"
                : state === "off"
                  ? "switched off"
                  : state === "done"
                    ? id in session.durations
                      ? seconds(session.durations[id])
                      : "reused"
                    : "";
          return (
            <div key={id} className={cn("flex flex-col gap-1.5 border border-stroke-secondary p-2.5", state === "run" && "bg-orange-quaternary")}>
              <span className={cn("text-[10px] tracking-[0.1em]", TONES[state])}>
                {MARKS[state]} {label}
              </span>
              <span className="min-h-[13px] text-[10px] normal-case tracking-normal text-text-tertiary">{detail}</span>
            </div>
          );
        })}
      </div>
      <p className={cn("font-sans text-[13px] normal-case tracking-normal", session.status === "failed" ? "text-red-primary" : "text-text-secondary")}>{message}</p>
    </div>
  );
}
