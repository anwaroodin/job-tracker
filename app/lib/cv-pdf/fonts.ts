import type { Font } from "@pdfme/common";
import plexSerifBold from "~/assets/fonts/ibmplexserif-bold.ttf?url";
import plexSerifSemiBold from "~/assets/fonts/ibmplexserif-semibold.ttf?url";
import plexSerif from "~/assets/fonts/ibmplexserif-regular.ttf?url";
import interBold from "~/assets/fonts/inter-bold.ttf?url";
import inter from "~/assets/fonts/inter-regular.ttf?url";
import montserrat from "~/assets/fonts/montserrat-semibold.ttf?url";
import termesBold from "~/assets/fonts/texgyretermes-bold.otf?url";
import termesBoldItalic from "~/assets/fonts/texgyretermes-bolditalic.otf?url";
import termesSmallCaps from "~/assets/fonts/texgyretermes-bold-smcp.otf?url";
import termesItalic from "~/assets/fonts/texgyretermes-italic.otf?url";
import termes from "~/assets/fonts/texgyretermes-regular.otf?url";

export type FontLoader = (url: string) => Promise<ArrayBuffer>;

export const FONTS = {
  Termes: { url: termes, ascent: 1.055 },
  "Termes Bold": { url: termesBold, ascent: 1.118 },
  "Termes Italic": { url: termesItalic, ascent: 1.07 },
  "Termes Bold Italic": { url: termesBoldItalic, ascent: 1.082 },
  "Termes Small Caps": { url: termesSmallCaps, ascent: 1.118 },
  "IBM Plex Serif": { url: plexSerif, ascent: 1.025 },
  "IBM Plex Serif Bold": { url: plexSerifBold, ascent: 1.025 },
  "IBM Plex Serif SemiBold": { url: plexSerifSemiBold, ascent: 1.025 },
  Inter: { url: inter, ascent: 0.9688 },
  "Inter Bold": { url: interBold, ascent: 0.9688 },
  "Montserrat SemiBold": { url: montserrat, ascent: 0.968 },
};

export type FontName = keyof typeof FONTS;

const cache = new Map<FontName, Promise<ArrayBuffer>>();

function fontData(name: FontName, load: FontLoader) {
  let data = cache.get(name);
  if (!data) {
    data = load(FONTS[name].url).catch((error) => {
      cache.delete(name);
      throw error;
    });
    cache.set(name, data);
  }
  return data;
}

export async function loadFonts(names: FontName[], load: FontLoader): Promise<Font> {
  const unique = [...new Set(names)];
  const entries = await Promise.all(unique.map(async (name, i) => [name, { data: await fontData(name, load), fallback: i === 0 }] as const));
  return Object.fromEntries(entries);
}
