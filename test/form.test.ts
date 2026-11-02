import { describe, expect, it } from "vitest";
import { jsonField } from "~/server/form.server";

const form = (value?: string) => {
  const f = new FormData();
  if (value !== undefined) f.set("cv", value);
  return f;
};

describe("jsonField", () => {
  it("parses the field, or the fallback when it's missing", () => {
    expect(jsonField(form('{"a":1}'), "cv", "{}")).toEqual({ a: 1 });
    expect(jsonField(form(), "cv", "[]")).toEqual([]);
  });

  it("answers malformed JSON with a 400 instead of a crash", () => {
    let thrown: unknown;
    try {
      jsonField(form("{not json"), "cv", "{}");
    } catch (e) {
      thrown = e;
    }
    expect((thrown as { init?: { status?: number } }).init?.status).toBe(400);
  });
});
