import { useEffect, useState } from "react";

const FIND_FOR_MS = 2500;

export type Box = { top: number; left: number; width: number; height: number };

export function useTargetBox(selector: string | undefined, step: number | undefined, pathname: string) {
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    setBox(null);
    if (!selector) return;
    let el: Element | null = null;
    let frame = 0;
    const started = performance.now();
    const measure = () => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      setBox(r.width && r.height ? { top: r.top, left: r.left, width: r.width, height: r.height } : null);
    };
    const observer = new ResizeObserver(measure);
    const find = () => {
      const found = [...document.querySelectorAll(selector)].find((e) => e.getBoundingClientRect().width);
      if (found) {
        el = found;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        observer.observe(el);
        measure();
        return;
      }
      if (performance.now() - started < FIND_FOR_MS) frame = requestAnimationFrame(find);
    };
    find();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [selector, step, pathname]);

  return box;
}
