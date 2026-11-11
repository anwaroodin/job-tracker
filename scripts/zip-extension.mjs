import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";

const BUCKET = process.env.CVS_BUCKET ?? "job-tracker-cvs";

const { version } = JSON.parse(readFileSync("extension/manifest.json", "utf8"));
const name = `job-tracker-extension-${version}.zip`;
const out = `dist/${name}`;

mkdirSync("dist", { recursive: true });
rmSync(out, { force: true });
execFileSync("zip", ["-rq", `../${out}`, ".", "-x", "*.DS_Store"], { cwd: "extension", stdio: "inherit" });
console.log(`Wrote ${out}`);

if (process.argv.includes("--publish")) {
  const target = process.argv.includes("--local") ? "--local" : "--remote";
  execFileSync(
    "npx",
    ["wrangler", "r2", "object", "put", `${BUCKET}/extension/latest.zip`, "--file", out, "--content-type", "application/zip", "--content-disposition", `attachment; filename="${name}"`, target],
    { stdio: "inherit" },
  );
  console.log(`Published ${name} to the dashboard's download link`);
}
