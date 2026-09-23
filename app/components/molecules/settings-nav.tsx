import { useEffect, useState } from "react";
import { cn } from "~/lib/cn";

export function SettingsNav({ items }: { items: { n: string; href: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.href.slice(1));

  useEffect(() => {
    const ids = items.map((i) => i.href.slice(1));
    const nodes = ids.map((id) => document.getElementById(id)).filter((n): n is HTMLElement => !!n);
    if (!nodes.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        // pick the topmost visible section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [items]);

  return (
    <nav className="sticky top-8 flex flex-col gap-0.5">
      {items.map((item) => {
        const id = item.href.slice(1);
        const isActive = active === id;
        return (
          <a
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-2.5 py-[7px] text-[11.5px] transition-colors duration-150",
              isActive ? "bg-fill-secondary text-text-primary" : "text-[#c9c9cd] hover:bg-fill-tertiary hover:text-text-primary",
            )}
          >
            <span className="text-text-tertiary">{item.n}</span>
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
