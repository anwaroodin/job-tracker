import { describe, expect, it } from "vitest";
import { json, preflight } from "~/server/extension/http.server";
import { EXTENSION_VERSION } from "~/server/extension/download.server";

const request = new Request("https://dashboard.test/api/ext/stats", { headers: { Origin: "chrome-extension://abc" } });

describe("extension updates", () => {
  it("names the latest version on every API response and lets the extension read it", () => {
    for (const res of [json(request, {}), preflight(request)]) {
      expect(res.headers.get("X-Extension-Latest")).toBe(EXTENSION_VERSION);
      expect(res.headers.get("Access-Control-Expose-Headers")).toBe("X-Extension-Latest");
    }
  });
});
