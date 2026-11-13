import { data } from "react-router";
import type { Route } from "./+types/index";
import { SharedApplication } from "~/components/share/shared-application";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { PRIVATE_HEADERS, sharedApplication } from "~/server/services/share/index.server";

export const meta: Route.MetaFunction = ({ loaderData }) => [
  { title: loaderData ? `${loaderData.job.role} at ${loaderData.job.company}` : "job-tracker" },
  { name: "robots", content: "noindex, nofollow" },
];

export const headers: Route.HeadersFunction = () => PRIVATE_HEADERS;

export async function loader({ context, params }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const shared = await sharedApplication(getDb(env.DB), params.token);
  if (!shared) throw data("Not found", { status: 404, headers: PRIVATE_HEADERS });
  const { cv, ...rest } = shared;
  return { ...rest, hasCv: !!cv };
}

export default function SharedApplicationPage({ loaderData, params }: Route.ComponentProps) {
  return <SharedApplication {...loaderData} pdfHref={`/s/${params.token}/cv.pdf`} />;
}
