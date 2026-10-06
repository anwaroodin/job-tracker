import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import webfontDownload from "vite-plugin-webfont-dl";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
    webfontDownload(
      "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@200;300;400;500;600&display=swap",
    ),
  ],
  build: {
    rolldownOptions: {
      output: {
        assetFileNames: (asset) =>
          asset.names.includes("webfonts.css") ? "webfonts.css" : "assets/[name]-[hash][extname]",
      },
    },
  },
  resolve: {
    tsconfigPaths: true,
  },
  environments: {
    ssr: { optimizeDeps: { exclude: ["typst-wasm"] } },
  },
});
