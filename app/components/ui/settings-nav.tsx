import { useEffect, useState } from "react";
import { cn } from "~/lib/cn";

export function SettingsNav({ items }: { items: { href: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.href.slice(1));

  useEffect(() => {
    const ids = items.map((i) => i.href.slice(1));
    const nodes = ids.map((id) => document.getElementById(id)).filter((n): n is HTMLElement => !!n);
    if (!nodes.length) return;

    const io = new IntersectionObserver(
      (entries) => {
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
              "flex h-9 items-center px-3 font-sans text-[14px] normal-case tracking-normal transition-colors",
              isActive ? "bg-ink/[0.07] font-medium text-text-primary" : "text-text-secondary hover:bg-ink/[0.04] hover:text-text-primary",
            )}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
