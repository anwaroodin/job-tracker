import { data } from "react-router";
import type { Route } from "./+types/pdf";
import { envContext } from "~/server/context.server";
import { renderCvPdf } from "~/server/cv/pdf.server";
import { getDb } from "~/server/db/client.server";
import { PRIVATE_HEADERS, sharedApplication } from "~/server/services/share/index.server";

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const shared = await sharedApplication(getDb(env.DB), params.token);
  if (!shared?.cv) throw data("Not found", { status: 404, headers: PRIVATE_HEADERS });
  const pdf = await renderCvPdf(env, new URL(request.url).origin, shared.cv);
  const filename = `${shared.job.company} CV`.replace(/[^\w .-]/g, "").trim() || "CV";
  return new Response(new Uint8Array(pdf), {
    headers: { ...PRIVATE_HEADERS, "content-type": "application/pdf", "content-disposition": `inline; filename="${filename}.pdf"` },
  });
}
