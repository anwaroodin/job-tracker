import { Cancel01Icon, MinusSignIcon, RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { useSelector } from "@legendapp/state/react";
import { Link } from "react-router";
import { CompanyLogo } from "~/components/applications/company-logo";
import { Meter } from "~/components/ui/meter";
import { usePersisted } from "~/hooks/use-persisted";
import { cn } from "~/lib/cn";
import { removeSession, stageIndex, STAGES, startSession, tailoring$, type SessionStatus, type TailoringSession } from "~/lib/state/tailoring";
import { tailoringTray$ } from "~/lib/state/tailoring-tray";

const TONES: Record<SessionStatus, { text: string; bar: string }> = {
  running: { text: "text-text-secondary", bar: "bg-accent-primary" },
  queued: { text: "text-text-tertiary", bar: "bg-text-tertiary" },
  questions: { text: "text-accent-primary", bar: "bg-accent-primary" },
  done: { text: "text-green-primary", bar: "bg-green-primary" },
  failed: { text: "text-red-primary", bar: "bg-red-primary" },
};

const SURFACE = "border border-stroke-primary bg-sidebar-active font-sans text-[14px] normal-case tracking-normal shadow-[0_24px_64px_rgba(0,0,0,0.22)]";

function statusText(s: TailoringSession) {
  if (s.status === "running") return STAGES[stageIndex(s.stage)]?.doing ?? "Starting…";
  if (s.status === "questions") return `${s.questions?.length ?? 0} questions need your answers`;
  if (s.status === "failed") return s.error ?? "Tailoring stopped";
  return s.status === "done" ? "Done. Open it to review" : "Queued";
}

const share = (s: TailoringSession) => (s.status === "done" ? 100 : (Math.max(0, stageIndex(s.stage)) / STAGES.length) * 100);

function IconButton({ icon, label, onClick }: { icon: IconSvgElement; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-7 shrink-0 cursor-pointer place-items-center text-text-tertiary transition-colors hover:bg-ink/[0.05] hover:text-text-primary"
    >
      <HugeiconsIcon icon={icon} size={15} strokeWidth={1.5} />
    </button>
  );
}

function Row({ session }: { session: TailoringSession }) {
  const tone = TONES[session.status];
  const retry = () => startSession({ company: session.company, role: session.role, href: session.href, target: session.target, model: session.model, letter: session.letter, pipeline: session.pipeline ?? "v1" });
  return (
    <li className="flex items-start gap-3 px-3 py-2.5 hover:bg-ink/[0.04]">
      <CompanyLogo company={"applicationId" in session.target ? session.company : ""} className="mt-0.5 size-8 text-[13px]" />
      <Link to={session.href} className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="min-w-0">
          <span className="block truncate font-medium text-text-primary">{session.company}</span>
          <span className="block truncate text-[12.5px] text-text-tertiary">{session.role}</span>
        </span>
        {session.status !== "failed" && <Meter share={share(session)} className={tone.bar} />}
        <span className={cn("text-[12.5px] leading-snug", tone.text, session.status === "failed" ? "line-clamp-3" : "truncate")} title={statusText(session)}>
          {statusText(session)}
        </span>
      </Link>
      {session.status === "failed" && <IconButton icon={RefreshIcon} label={`Try ${session.company} again`} onClick={retry} />}
      {session.status !== "running" && <IconButton icon={Cancel01Icon} label={`Remove ${session.company}`} onClick={() => removeSession(session.id)} />}
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
  const failed = count("failed");
  const done = count("done");
  const dot = failed ? "bg-red-primary" : asking ? "bg-accent-primary" : running ? "bg-accent-primary animate-pulse" : "bg-green-primary";
  const summary = [
    running > 0 && `${running} running`,
    asking > 0 && `${asking} need you`,
    failed > 0 && `${failed} stopped`,
    done > 0 && `${done} done`,
  ].filter(Boolean);

  return (
    <section aria-label="Tailoring" className="fixed bottom-[calc(var(--bottom-nav)+1rem)] right-4 z-40 lg:bottom-6 lg:right-6">
      {minimised ? (
        <button
          type="button"
          onClick={() => tailoringTray$.minimised.set(false)}
          className={cn(SURFACE, "flex h-10 cursor-pointer items-center gap-2 px-3.5 text-[13.5px] transition-colors hover:bg-sidebar")}
        >
          <span aria-hidden className={cn("size-2 rounded-full", dot)} />
          <span className="font-medium text-text-primary">Tailoring</span>
          <span className="text-text-tertiary">{summary.join(" · ")}</span>
        </button>
      ) : (
        <div className={cn(SURFACE, "w-[360px] max-w-[calc(100vw-2rem)]")}>
          <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-medium text-text-primary">
                <span aria-hidden className={cn("size-2 rounded-full", dot)} />
                Tailoring
              </p>
              <p className="truncate pl-4 text-[12.5px] text-text-tertiary">{summary.join(" · ")}. Keeps going while you browse.</p>
            </div>
            <IconButton icon={MinusSignIcon} label="Minimise" onClick={() => tailoringTray$.minimised.set(true)} />
          </div>
          <ul className="max-h-[50vh] overflow-y-auto border-t border-stroke-secondary px-1 py-1">
            {sessions.map((s) => (
              <Row key={s.id} session={s} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
