import { AnimatePresence, motion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigation } from "react-router";
import { cn } from "~/lib/cn";

let hydrated = false;

function useLeaving() {
  const navigation = useNavigation();
  const { pathname } = useLocation();
  return navigation.state === "loading" && navigation.location.pathname !== pathname;
}

export function NavProgress() {
  const leaving = useLeaving();
  return (
    <AnimatePresence>
      {leaving && (
        <motion.div
          key="progress"
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-text-primary"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{
            scaleX: [0, 0.35, 0.65, 0.9],
            opacity: 1,
            transition: { scaleX: { duration: 8, times: [0, 0.05, 0.3, 1], ease: "easeOut" }, opacity: { delay: 0.12, duration: 0.1 } },
          }}
          exit={{ scaleX: 1, opacity: 0, transition: { scaleX: { duration: 0.2, ease: "easeOut" }, opacity: { delay: 0.15, duration: 0.25 } } }}
        />
      )}
    </AnimatePresence>
  );
}

export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const leaving = useLeaving();
  useEffect(() => {
    hydrated = true;
  }, []);

  return (
    <div className={cn("transition-opacity duration-200", leaving && "opacity-60 delay-150")}>
      <motion.div key={pathname} initial={hydrated ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.18, ease: "easeOut" }}>
        {children}
      </motion.div>
    </div>
  );
}
