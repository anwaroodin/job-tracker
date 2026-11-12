import { describe, expect, it } from "vitest";
import { themeFromCookie } from "~/lib/theme";

describe("themeFromCookie", () => {
  it("reads a valid theme among other cookies", () => {
    expect(themeFromCookie("jt.session=abc; theme=light; other=1")).toBe("light");
    expect(themeFromCookie("theme=system")).toBe("system");
  });

  it("falls back to dark for missing, unknown or look-alike cookies", () => {
    expect(themeFromCookie(null)).toBe("light");
    expect(themeFromCookie("theme=purple")).toBe("light");
    expect(themeFromCookie("mytheme=dark")).toBe("light");
  });
});
