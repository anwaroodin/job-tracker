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
  route("api/ext/applications/:id", "routes/api/ext/application.ts"),
  
  route("api/gmail/status", "routes/api/gmail/status.ts"),
  route("api/activity", "routes/api/activity.ts"),
  route("api/search", "routes/api/search.ts"),
  route("api/cv/render", "routes/api/cv/render.ts"),
  route("api/cv/tailor", "routes/api/cv/tailor.ts"),
  
  ...prefix("auth", [
    route("login", "routes/auth/login.tsx"),
    route("logout", "routes/auth/logout.ts"),
  ]),
  
  // Authenticated app shell
  layout("routes/app/layout.tsx", [
    route("overview", "routes/app/overview.tsx"),
    route("applications", "routes/app/applications/index.tsx"),
    route("applications/:id", "routes/app/applications/[id].tsx"),
    route("applications/:id/cv", "routes/app/applications/cv.tsx"),
    route("cv", "routes/app/cv.tsx"),
    route("cv/roles/:id", "routes/app/role-cv.tsx"),
    route("profile", "routes/app/profile.tsx"),
    route("usage", "routes/app/usage.tsx"),
    route("settings", "routes/app/settings.tsx"),
  ]),
] satisfies RouteConfig;
