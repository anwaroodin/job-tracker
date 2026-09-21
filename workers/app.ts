import { RouterContextProvider, createRequestHandler } from "react-router";
import { envContext, execContext } from "~/server/context.server";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const context = new RouterContextProvider();
    context.set(envContext, env);
    context.set(execContext, ctx);
    return requestHandler(request, context);
  },
} satisfies ExportedHandler<Env>;
