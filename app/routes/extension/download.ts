import { data } from "react-router";
import type { Route } from "./+types/download";
import { envContext } from "~/server/context.server";
import { EXTENSION_KEY } from "~/server/extension/download.server";

export async function loader({ context }: Route.LoaderArgs) {
  const zip = await context.get(envContext).CVS.get(EXTENSION_KEY);
  if (!zip) throw data("No extension build has been published yet.", { status: 404 });
  const headers = new Headers({ "cache-control": "no-cache", etag: zip.httpEtag });
  zip.writeHttpMetadata(headers);
  return new Response(zip.body, { headers });
}
