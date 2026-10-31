import { newId } from "~/lib/cv";
import type { StarStory } from "~/types/cv";
import { list, obj, str } from "./clean";

const MAX_STORIES = 30;
const MAX_STORY_CHARS = 4000;

export function cleanStories(raw: unknown): StarStory[] {
  return list(raw)
    .slice(0, MAX_STORIES)
    .map((s) => ({ id: str(obj(s).id, 40) || newId(), title: str(obj(s).title), text: str(obj(s).text, MAX_STORY_CHARS) }))
    .filter((s) => s.title || s.text);
}

export function storedStories(json: string | null): StarStory[] {
  try {
    return json ? cleanStories(JSON.parse(json)) : [];
  } catch {
    return [];
  }
}
