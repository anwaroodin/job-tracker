import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useSelector } from "@legendapp/state/react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router";
import { CompanyLogo } from "~/components/applications/company-logo";
import { BrandWord, statusWord } from "~/components/shell/brand-word";
import { Button } from "~/components/ui/button";
import { milestone$, type Milestone } from "~/lib/state/milestone";

const TOAST_MS = 7000;

function nextStep(m: Milestone) {
  if (m.status === "interview") return { label: "Prepare for it", to: `/applications/${m.applicationId}#prep` };
  return { label: m.status === "accepted" ? "See your overview" : "See your offers", to: "/overview" };
}

export function MilestoneToast() {
  const milestone = useSelector(() => milestone$.get());
  const word = statusWord(milestone?.status);
  const dismiss = () => milestone$.set(null);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-16 z-50 grid justify-items-center px-4 sm:top-6">
      <AnimatePresence>
        {milestone && word && (
          <motion.div
            key={milestone.id}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="group pointer-events-auto relative w-full [grid-area:1/1] max-w-md overflow-hidden border border-stroke-primary bg-sidebar-active font-sans text-[14px] normal-case tracking-normal shadow-[0_24px_64px_rgba(0,0,0,0.22)]"
          >
            <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
              <BrandWord word={word} size={22} />
              <button
                type="button"
                aria-label="Dismiss"
                onClick={dismiss}
                className="-mr-1.5 -mt-1 grid size-7 cursor-pointer place-items-center text-text-tertiary transition-colors hover:bg-ink/[0.05] hover:text-text-primary"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex items-center gap-3 px-4 pb-4 pt-3">
              <CompanyLogo company={milestone.company} className="size-9 text-[14px]" />
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  <span className="font-medium text-text-primary">{milestone.company}</span>
                  <span className="text-[12.5px] text-text-tertiary"> · {milestone.role}</span>
                </p>
                <p className="whitespace-nowrap text-[12.5px] text-text-secondary">
                  Moved to {milestone.status.charAt(0).toUpperCase() + milestone.status.slice(1)}
                </p>
              </div>
              <Button asChild className="h-8 shrink-0 px-3 text-[13px]">
                <Link to={nextStep(milestone).to} onClick={dismiss}>
                  {nextStep(milestone).label}
                </Link>
              </Button>
            </div>
            <span
              aria-hidden
              className="countdown absolute inset-x-0 bottom-0 h-0.5 bg-ink/25"
              style={{ "--countdown": `${TOAST_MS}ms` } as React.CSSProperties}
              onAnimationEnd={dismiss}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
