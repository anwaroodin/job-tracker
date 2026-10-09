import { CompileError, createTypstCompiler, type TypstCompiler } from "typst-wasm";
import core from "typst-wasm/engine/engine.core.wasm";
import core2 from "typst-wasm/engine/engine.core2.wasm";
import core3 from "typst-wasm/engine/engine.core3.wasm";
import termesBold from "~/assets/fonts/texgyretermes-bold.otf?url";
import termesBoldItalic from "~/assets/fonts/texgyretermes-bolditalic.otf?url";
import termesItalic from "~/assets/fonts/texgyretermes-italic.otf?url";
import termesRegular from "~/assets/fonts/texgyretermes-regular.otf?url";
import type { TypstCv } from "~/types/cv";

const FONTS = [termesRegular, termesBold, termesItalic, termesBoldItalic];
const MAIN = "main.typ";

export type Rendered = { pages: string[] } | { pdf: Uint8Array } | { errors: string[] };

let compiler: Promise<TypstCompiler> | null = null;
let queue: Promise<unknown> = Promise.resolve();

function load(env: Env, origin: string) {
  compiler ??= (async () => {
    const typst = await createTypstCompiler({
      backend: "jspi",
      coreModules: { "engine.core.wasm": core, "engine.core2.wasm": core2, "engine.core3.wasm": core3 },
    });
    await typst.addFonts(
      ...FONTS.map((url) =>
        env.ASSETS.fetch(new URL(url, origin))
          .then((res) => res.arrayBuffer())
          .then((buffer) => new Uint8Array(buffer)),
      ),
    );
    return typst;
  })().catch((error) => {
    compiler = null;
    throw error;
  });
  return compiler;
}

function serially<T>(job: () => Promise<T>) {
  const run = queue.then(job, job);
  queue = run.catch(() => {});
  return run;
}

export function renderCv(env: Env, origin: string, template: string, cv: TypstCv, format: "svg" | "pdf"): Promise<Rendered> {
  return serially(async () => {
    const typst = await load(env, origin);
    await typst.addSource(MAIN, template);
    const inputs = { cv: JSON.stringify(cv) };
    try {
      if (format === "pdf") return { pdf: (await typst.compile({ format: "pdf", main: MAIN, inputs })).output };
      const { pages } = await typst.compile({ format: "svg", main: MAIN, inputs });
      return { pages: pages.map((page) => page.output) };
    } catch (error) {
      if (error instanceof CompileError) {
        return { errors: error.diagnostics.filter((d) => d.severity === "error").map((d) => (d.line ? `line ${d.line}: ${d.message}` : d.message)) };
      }
      throw error;
    }
  });
}
