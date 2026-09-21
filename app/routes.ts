import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),

  // Better Auth mounts at /api/auth/*
  route("api/auth/*", "routes/api/auth/catchall.ts"),

  // Browser-extension REST endpoints (session-authed)
  route("api/ext/stats", "routes/api/ext/stats.ts"),
  route("api/ext/profile", "routes/api/ext/profile.ts"),
  route("api/ext/applications", "routes/api/ext/applications.ts"),

  ...prefix("auth", [
    route("login", "routes/auth/login.tsx"),
    route("logout", "routes/auth/logout.ts"),
  ]),

  // Authenticated app shell
  layout("routes/app/layout.tsx", [
    route("overview", "routes/app/overview.tsx"),
    route("applications", "routes/app/applications/index.tsx"),
    route("applications/:id", "routes/app/applications/[id].tsx"),
    route("profile", "routes/app/profile.tsx"),
  ]),
] satisfies RouteConfig;
