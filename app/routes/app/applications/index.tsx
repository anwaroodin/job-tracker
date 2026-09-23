import type { Route } from "./+types/index";
import { Button } from "~/components/atoms/button";
import { ApplicationDataTable } from "~/components/organisms/application-data-table";
import { Section, stagger } from "~/components/molecules/terminal";
import { requireUser } from "~/server/auth.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import {
  createApplication,
  listApplications,
} from "~/server/db/applications.server";

const HIDDEN = new Set(["rejected", "ghosted", "withdrawn"]);
const ACTIVE = new Set(["applied", "screening", "interview", "assessment"]);
const OFFERED = new Set(["offer", "accepted"]);

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const db = getDb(env.DB);
  const rows = await listApplications(db, user.id);
  return { rows };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.get(envContext);
  const user = await requireUser(request, env);
  const form = await request.formData();
  const company = String(form.get("company") ?? "").trim();
  const role = String(form.get("role") ?? "").trim();
  if (!company || !role) return { error: "Company and role are required" };
  const db = getDb(env.DB);
  await createApplication(db, {
    id: crypto.randomUUID(),
    userId: user.id,
    company,
    role,
  });
  return { ok: true };
}

export default function Applications({ loaderData }: Route.ComponentProps) {
  const rows = loaderData.rows;
  const total = rows.length;
  const active = rows.filter((r) => ACTIVE.has(r.status)).length;
  const offers = rows.filter((r) => OFFERED.has(r.status)).length;
  const closed = rows.filter((r) => HIDDEN.has(r.status)).length;

  return (
    <div className="flex flex-col gap-12 font-mono text-[12.5px] uppercase tracking-[0.04em] first:gap-6">
      {/* ── [01] ─────────────────────────────────────────────────── */}
      <header
        className="rise flex flex-wrap items-end justify-between gap-6"
        style={stagger(0)}
      >
        <div>
          <p className="text-[11px] tracking-[0.12em] text-text-tertiary">
            <b className="mr-2 font-semibold text-text-primary">[02]</b>
            Applications
          </p>
          <h1 className="mt-7 max-w-2xl text-[24px] font-light leading-[1.25] tracking-tight sm:text-[30px]">
            <span className="text-text-primary">
              {total} applications logged.
            </span>
            <span className="block text-text-tertiary">
              {active} in flight, {offers} {offers === 1 ? "offer" : "offers"},{" "}
              {closed} closed.
            </span>
          </h1>
        </div>
        <Button type="button">+ New application</Button>
      </header>

      {/* ── [02] ─────────────────────────────────────────────────── */}
      <Section n="02" title="Records" hint="filter, search, sort" i={1}>
        <ApplicationDataTable rows={rows} />
      </Section>
    </div>
  );
}
