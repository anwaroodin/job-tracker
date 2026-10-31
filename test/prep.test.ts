import { describe, expect, it } from "vitest";
import { cleanStories } from "~/server/cv/prep";

describe("STAR stories", () => {
  it("keeps stories with content and gives them ids", () => {
    const stories = cleanStories([{ title: "Checkout", text: "Checkout was slow, I cached it" }, { title: "", text: " " }, "junk"]);
    expect(stories).toHaveLength(1);
    expect(stories[0]).toMatchObject({ title: "Checkout", text: "Checkout was slow, I cached it" });
    expect(stories[0].id).toBeTruthy();
  });
});
