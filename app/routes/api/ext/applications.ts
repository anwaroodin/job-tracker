import type { Route } from "./+types/applications";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { createApplication } from "~/server/db/applications.server";
import { extUser, json, preflight } from "~/server/ext-api.server";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method === "OPTIONS") return preflight(request);
  const env = context.get(envContext);
  const user = await extUser(request, env);
  if (!user)
    return json(request, { error: "not_authenticated" }, { status: 401 });

  const body = (await request.json()) as {
    company?: string;
    role?: string;
    url?: string;
    cv_type?: string;
    status?: string;
    category?: string;
    auto_filled?: boolean;
  };
  if (!body.company || !body.role) {
    return json(
      request,
      { error: "company and role are required" },
      { status: 400 },
    );
  }

  const row = await createApplication(getDb(env.DB), {
    id: crypto.randomUUID(),
    userId: user.id,
    company: body.company,
    role: body.role,
    url: body.url ?? "",
    cvType: body.cv_type ?? "software",
    status: body.status ?? "applied",
    category: body.category ?? null,
    autoFilled: body.auto_filled ?? true,
  });
  return json(request, { success: true, application: row }, { status: 201 });
}

export async function loader({ request }: Route.LoaderArgs) {
  if (request.method === "OPTIONS") return preflight(request);
  return json(request, { error: "method_not_allowed" }, { status: 405 });
}
