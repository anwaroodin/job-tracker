import type { Route } from "./+types/index";
import { Button } from "~/components/atoms/button";
import { ApplicationDataTable } from "~/components/organisms/application-data-table";
import { Divider, Hero, InlineStat } from "~/components/molecules/page";
import { requireUser } from "~/server/auth.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import {
  createApplication,
  listApplications,
} from "~/server/db/applications.server";
import { Plus } from "lucide-react";

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
    <div className="flex flex-col">
      <Hero
        eyebrow="Applications"
        title={total}
        subtitle={`${active} in flight · ${offers} offer${offers === 1 ? "" : "s"} · ${closed} closed`}
        aside={
          <>
            <InlineStat label="Active" value={active} />
            <InlineStat
              label="Offers"
              value={offers}
              tone={offers ? "up" : "neutral"}
            />
            <InlineStat label="Closed" value={closed} tone="neutral" />
            <div className="ml-2 self-end">
              <Button variant="primary" size="small">
                <Plus /> New application
              </Button>
            </div>
          </>
        }
      />

      <Divider />

      <div className="pt-6">
        <ApplicationDataTable rows={rows} />
      </div>
    </div>
  );
}
