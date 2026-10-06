import { useEffect, useRef, useState } from "react";
import { useRouteLoaderData } from "react-router";
import { cn } from "~/lib/cn";

const LOGO_DEV = "https://img.logo.dev/name/";

function logoSources(company: string, logoUrl: string | null | undefined, token: string | null) {
  const name = encodeURIComponent(company.trim());
  const byName = (strategy: "match" | "suggest") =>
    token && name ? `${LOGO_DEV}${name}?token=${token}&size=64&format=png&theme=dark&strategy=${strategy}&fallback=404` : "";
  return [logoUrl, byName("match"), byName("suggest")].filter((src): src is string => Boolean(src));
}

export function useLogoToken() {
  return (useRouteLoaderData("routes/app/layout") as { logoToken?: string | null } | undefined)?.logoToken ?? null;
}

export function CompanyLogo({ company, logoUrl, className }: { company: string; logoUrl?: string | null; className?: string }) {
  const sources = logoSources(company, logoUrl, useLogoToken());
  const [failed, setFailed] = useState(0);
  const img = useRef<HTMLImageElement>(null);
  const src = sources[failed];

  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth === 0) setFailed((n) => n + 1);
  }, [src]);

  return (
    <span
      aria-hidden
      className={cn(
        "relative flex size-5 shrink-0 items-center justify-center overflow-hidden bg-fill-secondary text-[10px] font-medium text-text-secondary",
        "after:pointer-events-none after:absolute after:inset-0 after:ring-1 after:ring-inset after:ring-white/10",
        className,
      )}
    >
      {src ? (
        <img ref={img} key={src} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed((n) => n + 1)} className="size-full object-contain" />
      ) : (
        company.trim().charAt(0).toUpperCase()
      )}
    </span>
  );
}

export function LogoCredit() {
  if (!useLogoToken()) return null;
  return (
    <p className="text-[10.5px] tracking-[0.1em] text-text-tertiary">
      <a href="https://logo.dev" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text-primary">
        Logos provided by Logo.dev
      </a>
    </p>
  );
}
