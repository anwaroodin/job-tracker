import { cn } from "~/lib/cn";

const ASTERISK = (
  <g fill="var(--brand)">
    <path d="M115.79 -109.34L115.79 2.14L140.61 2.14L140.61 -109.34Z" />
    <path d="M170.27 -92.22L73.72 -36.48L86.13 -14.98L182.68 -70.72Z" />
    <path d="M182.68 -36.48L86.13 -92.22L73.72 -70.72L170.27 -14.98Z" />
  </g>
);

export function Wordmark({ className }: { className?: string }) {
  return (
    <svg viewBox="-2 -146 314 178" role="img" aria-label="j*b" className={cn("text-text-primary", className)}>
      <path fill="currentColor" d="M-0.60 30.0V7.60H11.4Q17.2 7.60 20.20 5.2Q23.20 2.80 23.20 -4.4V-107.2H53.2V-3.6Q53.2 14.4 45.1 22.2Q37.0 30.0 17.40 30.0ZM22.6 -120.4V-144.4H53.60V-120.4Z" />
      {ASTERISK}
      <path fill="currentColor" d="M265.0 2.40Q253.79 2.40 245.5 -2.4Q237.2 -7.2 232.6 -15.8L232.0 0.0H203.39V-142.0H233.39V-92.0Q237.6 -99.4 245.8 -104.5Q254.0 -109.60 265.0 -109.60Q278.6 -109.60 288.6 -102.70Q298.6 -95.80 304.1 -83.20Q309.6 -70.60 309.6 -53.6Q309.6 -36.6 304.1 -24.0Q298.6 -11.4 288.6 -4.5Q278.6 2.40 265.0 2.40ZM256.6 -20.6Q266.6 -20.6 272.70 -29.3Q278.8 -38.0 278.8 -53.6Q278.8 -69.2 272.8 -77.9Q266.8 -86.60 256.8 -86.60Q249.39 -86.60 244.09 -82.70Q238.79 -78.80 236.09 -71.4Q233.39 -64.0 233.39 -53.6Q233.39 -43.40 236.09 -36.0Q238.79 -28.6 244.09 -24.6Q249.39 -20.6 256.6 -20.6Z" />
    </svg>
  );
}

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="70 -112 116 116" role="img" aria-label="j*b" className={className}>
      {ASTERISK}
    </svg>
  );
}
