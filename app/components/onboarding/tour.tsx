import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { NAV } from "~/components/shell/nav";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";
import { onboarding$ } from "~/lib/state/onboarding";
import { isLessonId, LESSONS, type LessonId, type LessonStep } from "./lessons";
import { type Box, useTargetBox } from "./use-target-box";

const PAD = 6;
const GAP = 14;
const CARD_W = 360;
const BUTTON = "h-8 px-3 text-[13px]";
const BOTTOM_NAV_PX = 72;
const LG_PX = 1024;

const floor = () => window.innerHeight - (window.innerWidth < LG_PX ? BOTTOM_NAV_PX : 16);

export function Tour() {
  const [params, setParams] = useSearchParams();
  const [run, setRun] = useState<{ id: LessonId; step: number } | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const requested = params.get("lesson");
  useEffect(() => {
    if (!requested) return;
    if (isLessonId(requested)) setRun({ id: requested, step: 0 });
    setParams(
      (p) => {
        p.delete("lesson");
        return p;
      },
      { replace: true, preventScrollReset: true },
    );
  }, [requested, setParams]);

  const steps: readonly LessonStep[] = run ? LESSONS[run.id].steps : [];
  const path = run ? steps[run.step]?.path : undefined;
  const elsewhere = !!path && path !== pathname;
  const step = run && (elsewhere ? goTo(path) : steps[run.step]);
  const target = step?.target;
  const click = !!step?.click;

  const box = useTargetBox(target, run?.step, pathname);

  const close = () => setRun(null);
  const go = (delta: number) => {
    if (!run) return;
    if (delta > 0 && elsewhere) return navigate(path);
    const next = run.step + delta;
    if (next < 0) return;
    if (next >= steps.length) {
      onboarding$.done.set((d) => (d.includes(run.id) ? d : [...d, run.id]));
      return close();
    }
    setRun({ ...run, step: next });
  };

  const waiting = click && !!box;
  useEffect(() => {
    if (!waiting || !target) return;
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest(target) && !elsewhere) go(1);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  });

  useEffect(() => {
    if (!run) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight" && !waiting) go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {run && step && (
        <motion.div
          key="tour"
          className="pointer-events-none fixed inset-0 z-[70]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Spotlight box={box} />
          <Card
            box={box}
            lesson={LESSONS[run.id].title}
            index={run.step}
            total={steps.length}
            title={step.title}
            body={step.body}
            waiting={waiting}
            onBack={() => go(-1)}
            onNext={() => go(1)}
            onClose={close}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function goTo(path: string): LessonStep {
  const label = NAV.find((n) => n.to === path)?.label ?? path;
  const where = window.innerWidth < LG_PX ? "the bar at the bottom of the screen" : "the sidebar";
  return {
    target: `[data-nav="${path}"]`,
    click: true,
    title: `Open ${label}`,
    body: `${label} lives in ${where}. Click it to go there.`,
  };
}

function Spotlight({ box }: { box: Box | null }) {
  const hole = box
    ? { top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 }
    : { top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0 };
  return (
    <motion.div
      aria-hidden
      className={cn("fixed border", box ? "border-accent-primary" : "border-transparent", "[box-shadow:0_0_0_200vmax_var(--scrim)]")}
      initial={false}
      animate={hole}
      transition={{ type: "spring", stiffness: 260, damping: 32 }}
    >
      {box && (
        <motion.span
          className="absolute -inset-px border border-accent-primary"
          animate={{ opacity: [0.9, 0], scale: [1, 1.04] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
        />
      )}
    </motion.div>
  );
}

function Card(props: {
  box: Box | null;
  lesson: string;
  index: number;
  total: number;
  title: string;
  body: string;
  waiting: boolean;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const { box, index, total } = props;
  const nextRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(200);
  useEffect(() => nextRef.current?.focus({ preventScroll: true }), [index]);
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const observer = new ResizeObserver(() => setHeight(card.offsetHeight));
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  const width = Math.min(CARD_W, window.innerWidth - 32);
  const place = box ? placeNear(box, width, height) : { left: (window.innerWidth - width) / 2, top: (window.innerHeight - height) / 2 };
  const last = index === total - 1;

  return (
    <motion.div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-title"
      className="pointer-events-auto fixed flex flex-col gap-3 border border-stroke-primary bg-sidebar-active p-5 font-sans text-[14px] normal-case tracking-normal shadow-[0_24px_64px_rgba(0,0,0,0.22)]"
      style={{ width }}
      initial={false}
      animate={place}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
    >
      <div className="flex items-center justify-between gap-3 text-[12.5px] text-text-tertiary">
        <span className="truncate">
          {props.lesson} · <span className="tabular-nums">{index + 1} of {total}</span>
        </span>
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close tour"
          className="-mr-2 -mt-1 grid size-8 shrink-0 cursor-pointer place-items-center transition-colors hover:bg-ink/[0.04] hover:text-text-primary"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={1.5} />
        </button>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={props.title}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          aria-live="polite"
        >
          <h2 id="tour-title" className="text-[16px] font-medium text-text-primary">
            {props.title}
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-secondary">{props.body}</p>
        </motion.div>
      </AnimatePresence>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span aria-hidden className="flex gap-1.5">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={cn("size-1.5 rounded-full", i <= index ? "bg-text-primary" : "bg-ink/15")} />
          ))}
        </span>
        <div className="flex items-center gap-2">
          {index > 0 && (
            <Button type="button" variant="ghost" className={BUTTON} onClick={props.onBack}>
              Back
            </Button>
          )}
          {props.waiting ? (
            <span className="flex items-center gap-2 text-[13px] font-medium text-accent-primary">
              <span className="size-1.5 animate-pulse rounded-full bg-accent-primary" />
              Click it to continue
            </span>
          ) : (
            <Button ref={nextRef} type="button" className={BUTTON} onClick={props.onNext}>
              {last ? "Done" : "Next"}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function placeNear(box: Box, width: number, height: number) {
  const left = Math.min(Math.max(16, box.left), window.innerWidth - width - 16);
  const below = box.top + box.height + PAD + GAP;
  if (below + height < floor()) return { left, top: below };
  const above = box.top - PAD - GAP - height;
  if (above >= 16) return { left, top: above };
  return { left: window.innerWidth - width - 16, top: floor() - height };
}
