import { data } from "react-router";
import type { Route } from "./+types/[id]";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/atoms/card";
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
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-text-primary">{row.company}</h1>
          <p className="mt-0.5 text-[13px] text-text-secondary">{row.role}</p>
        </div>
        <StatusBadge status={row.status} />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Location" value={row.location || "—"} />
          <Field label="Work type" value={row.workType || "—"} />
          <Field label="Salary" value={row.salary || "—"} />
          <Field label="CV" value={row.cvType} />
          <Field label="Applied" value={new Date(row.appliedAt).toLocaleString()} />
          <Field label="Updated" value={new Date(row.updatedAt).toLocaleString()} />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-text-secondary">{label}</span>
      <span className="text-sm text-text-primary">{value}</span>
    </div>
  );
}
