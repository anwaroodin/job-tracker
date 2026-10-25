import { data } from "react-router";
import type { Route } from "./+types/share";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { getApplication } from "~/server/db/queries/applications.server";
import { deleteShareLink, updateShareLink } from "~/server/db/queries/share-links.server";
import { createShareLink, expiryIn, shareDays } from "~/server/services/share/index.server";

export async function action({ request, context, params }: Route.ActionArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  if (!(await getApplication(db, user.id, params.id))) throw data("Not found", { status: 404 });
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "create") {
    const token = await createShareLink(db, user.id, params.id, shareDays(form.get("days")), form.get("includeCv") === "true");
    return { url: new URL(`/s/${token}`, request.url).toString() };
  }
  if (intent === "update") {
    await updateShareLink(db, user.id, params.id, new Date().toISOString(), {
      ...(form.has("days") && { expiresAt: expiryIn(shareDays(form.get("days"))) }),
      ...(form.has("includeCv") && { includeCv: form.get("includeCv") === "true" }),
    });
    return { ok: true };
  }
  if (intent === "revoke") {
    await deleteShareLink(db, user.id, params.id);
    return { ok: true };
  }
  throw data("Unknown intent", { status: 400 });
}
