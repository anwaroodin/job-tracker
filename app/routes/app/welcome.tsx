import { redirect, useRouteLoaderData, useSearchParams } from "react-router";
import type { Route } from "./+types/welcome";
import type { loader as layoutLoader } from "./layout";
import { SETUP_STEPS, SetupScreen } from "~/components/onboarding/setup";
import { isLessonId } from "~/components/onboarding/lessons";
import { userContext } from "~/server/auth/session.server";
import { envContext } from "~/server/context.server";
import { getDb } from "~/server/db/client.server";
import { getProfile, saveProfile } from "~/server/db/queries/profile.server";
import { markOnboarded } from "~/server/db/queries/settings.server";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const profile = await getProfile(getDb(env.DB), user.id);
  return { user, personal: profile.personal };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.get(envContext);
  const user = context.get(userContext);
  const db = getDb(env.DB);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "details") {
    const profile = await getProfile(db, user.id);
    const text = (k: string) => String(form.get(k) ?? "").trim().slice(0, 200);
    await saveProfile(db, user.id, {
      ...profile,
      personal: {
        ...profile.personal,
        firstName: text("firstName"),
        lastName: text("lastName"),
        email: text("email"),
        phone: text("phone"),
        address: { ...profile.personal.address, city: text("city"), country: text("country") },
      },
    });
    throw redirect("/welcome?step=gmail");
  }

  await markOnboarded(db, user.id);
  const lesson = String(form.get("lesson") ?? "");
  throw redirect(intent === "finish" && isLessonId(lesson) ? `/overview?lesson=${lesson}` : "/overview");
}

export default function Welcome({ loaderData }: Route.ComponentProps) {
  const gmail = useRouteLoaderData<typeof layoutLoader>("routes/app/layout")!.gmail;
  const [params] = useSearchParams();
  const asked = SETUP_STEPS.find((s) => s === params.get("step")) ?? "intro";
  const step = gmail.connected && asked !== "details" ? "done" : asked;
  return <SetupScreen step={step} user={loaderData.user} personal={loaderData.personal} gmail={gmail} />;
}
