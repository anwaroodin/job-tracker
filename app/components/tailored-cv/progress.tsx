import { useNow } from "~/hooks/use-now";
import { cn } from "~/lib/cn";
import { stageIndex, STAGES, type TailoringSession } from "~/lib/state/tailoring";

type StepState = "done" | "run" | "ask" | "wait" | "off";

const DOTS: Record<StepState, string> = {
  done: "border-text-primary bg-text-primary",
  run: "border-accent-primary bg-accent-primary animate-pulse",
  ask: "border-accent-primary bg-bg-primary",
  wait: "border-stroke-primary bg-bg-primary",
  off: "border-dashed border-stroke-primary bg-bg-primary",
};

export function seconds(ms: number) {
  const total = Math.max(1, Math.round(ms / 1000));
  return total < 60 ? `${total}s` : `${Math.floor(total / 60)}m ${total % 60}s`;
}

function stepState(session: TailoringSession, id: string, index: number, current: number): StepState {
  if (id === "letter" && (!session.letter || "roleId" in session.target)) return "off";
  if (session.status === "done") return "done";
  if (session.status === "questions") return id === "plan" ? "ask" : index < current ? "done" : "wait";
  if (id === session.stage) return session.status === "running" ? "run" : "wait";
  return index < current || id in session.durations ? "done" : "wait";
}

function detail(session: TailoringSession, id: string, state: StepState) {
  if (state === "run") return "Working";
  if (state === "ask") return "Needs you";
  if (state === "off") return "Off";
  if (state === "done") return id in session.durations ? seconds(session.durations[id]) : "Reused";
  return "";
}

export function TailorProgress({ session }: { session: TailoringSession }) {
  const now = useNow(1000);
  const current = stageIndex(session.status === "questions" ? "plan" : session.stage);
  const elapsed = session.stageStartedAt ? now - session.stageStartedAt : 0;
  const total = Object.values(session.durations).reduce((a, b) => a + b, 0);

  const message =
    session.status === "running"
      ? `${STAGES[current]?.doing ?? "Starting…"} ${seconds(elapsed)} so far. You can browse other pages while it works.`
      : session.status === "queued"
        ? "Queued. It starts when the tailoring ahead of it finishes."
        : session.status === "questions"
          ? `Paused until you answer ${session.questions?.length ?? 0} questions below.`
          : session.status === "failed"
            ? null
            : `Done in ${seconds(total)}.`;

  return (
    <div className="flex flex-col gap-4">
      <div className="no-scrollbar overflow-x-auto">
        <ol className="flex min-w-[520px]">
          {STAGES.map(({ id, label }, index) => {
            const state = stepState(session, id, index, current);
            return (
              <li key={id} className="relative flex flex-1 flex-col items-center gap-1 text-center">
                {index > 0 && (
                  <span aria-hidden className={cn("absolute right-1/2 top-[5px] h-px w-full", state === "done" || state === "run" ? "bg-text-primary" : "bg-stroke-secondary")} />
                )}
                <span aria-hidden className={cn("relative size-[11px] rounded-full border", DOTS[state])} />
                <span className={cn("mt-1 text-[12.5px] font-medium", state === "wait" || state === "off" ? "text-text-tertiary" : "text-text-primary")}>{label}</span>
                <span className="min-h-4 text-[12px] tabular-nums text-text-tertiary">{detail(session, id, state)}</span>
              </li>
            );
          })}
        </ol>
      </div>
      {message && <p className="text-[13.5px] text-text-secondary">{message}</p>}
    </div>
  );
}
