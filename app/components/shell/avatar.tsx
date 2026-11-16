import { cn } from "~/lib/cn";

export function Avatar({ user, className }: { user: { name?: string | null; email: string; image?: string | null }; className?: string }) {
  if (user.image) return <img src={user.image} alt="" referrerPolicy="no-referrer" className={cn("size-8 shrink-0 rounded-full", className)} />;
  return (
    <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-semibold text-white", className)}>
      {(user.name ?? user.email).slice(0, 1).toUpperCase()}
    </div>
  );
}
