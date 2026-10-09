import { useState } from "react";
import { Link, useFetcher } from "react-router";
import { fmtDate } from "~/components/ui/terminal";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

interface RoleCvRow {
  id: string;
  title: string;
  version: number;
  updatedAt: string;
}

export function RoleCvs({ roles }: { roles: RoleCvRow[] }) {
  const fetcher = useFetcher();
  const [title, setTitle] = useState("");
  const busy = fetcher.state !== "idle";
  const create = () => title.trim() && fetcher.submit({ intent: "role", title: title.trim() }, { method: "post" });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex max-w-xl gap-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            create();
          }}
          placeholder="Job title, e.g. Retail Assistant"
          aria-label="Job title"
          maxLength={120}
          className="font-sans normal-case"
        />
        <Button type="button" size="medium" className="shrink-0 uppercase" disabled={busy || !title.trim()} onClick={create}>
          {busy ? "Opening…" : "Tailor"}
        </Button>
      </div>
      {roles.length > 0 && (
        <ul className="flex flex-col">
          {roles.map((role) => (
            <li key={role.id}>
              <Link to={`/cv/roles/${role.id}`} className="group flex items-baseline gap-2.5 py-[7px]">
                <span className="shrink-0 text-text-secondary group-hover:text-accent-primary">{role.title}</span>
                <span className="min-w-3 flex-1 -translate-y-[3px] border-b border-dotted border-white/25" />
                <span className="text-right text-text-tertiary">{role.version ? `v${role.version} · ${fmtDate(role.updatedAt)}` : "Not tailored yet"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
