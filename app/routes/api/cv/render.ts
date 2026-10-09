import { data } from "react-router";
import type { Route } from "./+types/render";
import { getSession } from "~/server/auth/session.server";
import { cached } from "~/server/cache.server";
import { envContext } from "~/server/context.server";
import { renderCv } from "~/server/cv/typst.server";
import type { TypstCv } from "~/types/cv";

const MAX_BODY_CHARS = 200_000;
const PREVIEW_TTL_SECONDS = 7 * 24 * 60 * 60;

async function hashOf(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.get(envContext);
  const session = await getSession(request, env);
  if (!session?.user) throw data({ error: "not_authenticated" }, { status: 401 });

  const body = await request.text();
  if (body.length > MAX_BODY_CHARS) throw data({ error: "too_large" }, { status: 413 });
  const { template, cv, format } = JSON.parse(body) as { template: string; cv: TypstCv; format: "svg" | "pdf" };
  if (typeof template !== "string" || !cv || (format !== "svg" && format !== "pdf")) throw data({ error: "invalid" }, { status: 400 });

  const origin = new URL(request.url).origin;
  if (format === "pdf") {
    const rendered = await renderCv(env, origin, template, cv, "pdf");
    if ("errors" in rendered) return Response.json(rendered, { status: 422 });
    if (!("pdf" in rendered)) throw data({ error: "no_pdf" }, { status: 500 });
    return new Response(new Uint8Array(rendered.pdf), { headers: { "content-type": "application/pdf" } });
  }

  const key = `pages/${session.user.id}/${await hashOf(body)}`;
  return Response.json(await cached("cv-svg", key, PREVIEW_TTL_SECONDS, () => renderCv(env, origin, template, cv, "svg")));
}
