import { describe, expect, it } from "vitest";
import { json, preflight } from "~/server/extension/http.server";
import { EXTENSION_VERSION } from "~/server/extension/download.server";

const UPDATE_MODULE = "../extension/src/lib/update.js";
const { isNewer } = (await import(/* @vite-ignore */ UPDATE_MODULE)) as { isNewer: (latest: string, current: string) => boolean };

const request = new Request("https://dashboard.test/api/ext/stats", { headers: { Origin: "chrome-extension://abc" } });

describe("extension updates", () => {
  it("compares versions part by part", () => {
    expect(isNewer("3.3.0", "3.2.9")).toBe(true);
    expect(isNewer("3.10.0", "3.9.0")).toBe(true);
    expect(isNewer("3.3", "3.3.0")).toBe(false);
    expect(isNewer("3.2.0", "3.3.0")).toBe(false);
  });

  it("names the latest version on every API response and lets the extension read it", () => {
    for (const res of [json(request, {}), preflight(request)]) {
      expect(res.headers.get("X-Extension-Latest")).toBe(EXTENSION_VERSION);
      expect(res.headers.get("Access-Control-Expose-Headers")).toBe("X-Extension-Latest");
    }
  });
});
