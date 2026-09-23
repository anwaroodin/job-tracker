import { data, Link } from "react-router";
import type { Route } from "./+types/[id]";
import { Leader, Section, fmtDate, stagger } from "~/components/molecules/terminal";
import { StatusBadge } from "~/components/molecules/status-badge";
import { requireUser } from "~/server/auth.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { getApplication } from "~/server/db/applications.server";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const db = getDb(env.DB);
  const row = await getApplication(db, user.id, params.id);
  if (!row) throw data("Not found", { status: 404 });
  return { row };
}

export default function ApplicationDetail({ loaderData }: Route.ComponentProps) {
  const { row } = loaderData;
  return (
    <div className="flex flex-col gap-12 font-mono text-[12.5px] uppercase tracking-[0.04em] first:gap-6">
      {/* ── [02] ─────────────────────────────────────────────────── */}
      <header className="rise" style={stagger(0)}>
        <p className="text-[11px] tracking-[0.12em] text-text-tertiary">
          <Link to="/applications" className="transition-colors hover:text-text-primary">
            [02] Applications
          </Link>
          <span className="mx-2 opacity-50">/</span>
          {row.company}
        </p>
        <h1 className="mt-7 max-w-2xl text-[24px] font-light leading-[1.25] tracking-tight text-text-primary sm:text-[30px]">
          {row.company}
          <span className="block text-text-tertiary">{row.role}</span>
        </h1>
        <p className="mt-5">
          <StatusBadge status={row.status} />
        </p>
      </header>

      {/* ── [02] ─────────────────────────────────────────────────── */}
      <Section n="02" title="Details" i={1}>
        <div className="grid grid-cols-1 gap-x-16 sm:grid-cols-2">
          <Leader label="Location">{row.location || "—"}</Leader>
          <Leader label="Work type">{row.workType || "—"}</Leader>
          <Leader label="Salary">{row.salary || "—"}</Leader>
          <Leader label="CV">{row.cvType}</Leader>
          <Leader label="Applied">{fmtDate(row.appliedAt)}</Leader>
          <Leader label="Updated">{fmtDate(row.updatedAt)}</Leader>
        </div>
      </Section>
    </div>
  );
}
