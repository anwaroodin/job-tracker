import { useSelector } from "@legendapp/state/react";
import { Minus, X } from "lucide-react";
import { Link } from "react-router";
import { CompanyLogo } from "~/components/applications/company-logo";
import { Button } from "~/components/ui/button";
import { usePersisted } from "~/hooks/use-persisted";
import { cn } from "~/lib/cn";
import { removeSession, stageIndex, STAGES, tailoring$, type SessionStatus, type TailoringSession } from "~/lib/state/tailoring";
import { tailoringTray$ } from "~/lib/state/tailoring-tray";

const TONES: Record<SessionStatus, string> = {
  running: "text-accent-primary",
  queued: "text-text-tertiary",
  questions: "text-red-primary",
  done: "text-green-primary",
  failed: "text-red-primary",
};

const CELLS = 14;

function statusText(s: TailoringSession) {
  if (s.status === "running") return STAGES[stageIndex(s.stage)]?.doing.replace("…", "") ?? "Starting";
  if (s.status === "questions") return `Needs ${s.questions?.length ?? 0} answers`;
  if (s.status === "failed") return "Failed";
  return s.status === "done" ? "Done" : "Queued";
}

function progressBar(s: TailoringSession) {
  const share = s.status === "done" ? 1 : Math.max(0, stageIndex(s.stage)) / STAGES.length;
  const filled = Math.round(share * CELLS);
  return "█".repeat(filled) + "░".repeat(CELLS - filled);
}

function Row({ session }: { session: TailoringSession }) {
  return (
    <li className="group flex items-center gap-3 border-b border-stroke-secondary px-3.5 py-2.5 last:border-b-0">
      <CompanyLogo company={"applicationId" in session.target ? session.company : ""} className="size-6 text-[11px]" />
      <Link to={session.href} className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-sans text-[13px] normal-case tracking-normal text-text-primary group-hover:text-accent-primary">
          {session.company}
          <span className="text-text-tertiary"> · {session.role}</span>
        </span>
        <span className={cn("flex items-center gap-2 text-[10px] tracking-[0.06em]", TONES[session.status])}>
          <span className="tracking-normal">{progressBar(session)}</span>
          <span className="truncate">{statusText(session)}</span>
        </span>
      </Link>
      {session.status !== "running" && (
        <button
          type="button"
          onClick={() => removeSession(session.id)}
          aria-label={`Remove ${session.company}`}
          className="cursor-pointer p-1 text-text-tertiary transition-colors hover:text-text-primary"
        >
          <X className="size-3.5" />
        </button>
      )}
    </li>
  );
}

export function TailoringTray() {
  const sessions = useSelector(() => Object.values(tailoring$.get()).sort((a, b) => a.createdAt - b.createdAt));
  const minimised = usePersisted(() => tailoringTray$.minimised.get(), false);
  if (sessions.length === 0) return null;

  const count = (status: SessionStatus) => sessions.filter((s) => s.status === status).length;
  const running = count("running") + count("queued");
  const asking = count("questions");
  const done = count("done");

  return (
    <section
      aria-label="Tailoring sessions"
      className="fixed bottom-[calc(var(--bottom-nav)+1rem)] right-4 z-40 font-mono uppercase lg:bottom-6 lg:right-6"
    >
      {minimised ? (
        <Button type="button" variant="secondary" size="small" className="uppercase" onClick={() => tailoringTray$.minimised.set(false)}>
          <span className={cn("size-1.5 rounded-full", running ? "bg-accent-primary" : "bg-text-tertiary")} />
          Tailoring {running}
          {asking > 0 && <span className="text-red-primary">· {asking} need you</span>}
          {done > 0 && <span className="text-green-primary">· {done} done</span>}
        </Button>
      ) : (
        <div className="w-[360px] max-w-[calc(100vw-2rem)] border border-stroke-primary bg-bg-secondary">
          <div className="flex items-center justify-between border-b border-stroke-secondary py-1.5 pl-3.5 pr-1.5 text-[10.5px] tracking-[0.12em] text-text-tertiary">
            Tailoring · {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
            <button
              type="button"
              onClick={() => tailoringTray$.minimised.set(true)}
              aria-label="Minimise"
              className="cursor-pointer p-1.5 transition-colors hover:text-text-primary"
            >
              <Minus className="size-3.5" />
            </button>
          </div>
          <ul className="max-h-[50vh] overflow-y-auto">
            {sessions.map((s) => (
              <Row key={s.id} session={s} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
