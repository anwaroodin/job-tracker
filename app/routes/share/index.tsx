import { data } from "react-router";
import type { Route } from "./+types/index";
import { SharedApplication } from "~/components/share/shared-application";
import { cached } from "~/server/cache.server";
import { envContext } from "~/server/context.server";
import { renderCv } from "~/server/cv/typst.server";
import { getDb } from "~/server/db/client.server";
import { PRIVATE_HEADERS, sha256, sharedApplication } from "~/server/services/share/index.server";

const PREVIEW_TTL_SECONDS = 24 * 60 * 60;

export const meta: Route.MetaFunction = ({ loaderData }) => [
  { title: loaderData ? `${loaderData.job.role} at ${loaderData.job.company}` : "job-tracker" },
  { name: "robots", content: "noindex, nofollow" },
];

export const headers: Route.HeadersFunction = () => PRIVATE_HEADERS;

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const shared = await sharedApplication(getDb(env.DB), params.token);
  if (!shared) throw data("Not found", { status: 404, headers: PRIVATE_HEADERS });
  const { cv, ...rest } = shared;
  if (!cv) return { ...rest, pages: null };
  const origin = new URL(request.url).origin;
  const rendered = await cached("share-cv", await sha256(JSON.stringify(cv)), PREVIEW_TTL_SECONDS, () => renderCv(env, origin, cv.template, cv.typst, "svg"));
  return { ...rest, pages: "pages" in rendered ? rendered.pages : [] };
}

export default function SharedApplicationPage({ loaderData, params }: Route.ComponentProps) {
  return <SharedApplication {...loaderData} pdfHref={`/s/${params.token}/cv.pdf`} />;
}
