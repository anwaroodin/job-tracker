import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";

const { version } = JSON.parse(readFileSync("extension/manifest.json", "utf8"));
const out = `dist/job-tracker-extension-${version}.zip`;

mkdirSync("dist", { recursive: true });
rmSync(out, { force: true });
execFileSync("zip", ["-rq", `../${out}`, ".", "-x", "*.DS_Store"], { cwd: "extension", stdio: "inherit" });
console.log(`Wrote ${out}`);
