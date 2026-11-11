import { useSearchParams } from "react-router";
import type { Route } from "./+types/extension";
import { Button } from "~/components/ui/button";
import { Leader, Section, fmtDate, stagger, two } from "~/components/ui/terminal";
import { envContext } from "~/server/context.server";
import { EXTENSION_VERSION, publishedExtension } from "~/server/extension/download.server";

export async function loader({ context }: Route.LoaderArgs) {
  const publishedAt = await publishedExtension(context.get(envContext).CVS);
  return { version: EXTENSION_VERSION, publishedAt };
}

const Code = ({ children }: { children: React.ReactNode }) => <code className="font-mono text-text-primary">{children}</code>;

function Steps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-4 border-b border-dashed border-white/10 py-3 first:pt-0">
          <span className="text-text-tertiary tabular-nums">{two(i + 1)}</span>
          <span className="font-sans text-[13.5px] normal-case leading-relaxed tracking-normal text-text-secondary">{step}</span>
        </li>
      ))}
    </ol>
  );
}

export default function ExtensionPage({ loaderData }: Route.ComponentProps) {
  const { version, publishedAt } = loaderData;
  const from = useSearchParams()[0].get("from");

  return (
    <div className="flex flex-col gap-12 font-mono text-[12.5px] uppercase tracking-[0.04em]">
      <header className="rise" style={stagger(0)}>
        <p className="text-[11px] tracking-[0.12em] text-text-tertiary">Extension</p>
        <h1 className="mt-7 max-w-2xl text-[24px] font-light leading-[1.25] tracking-tight text-text-primary sm:text-[30px]">
          {from ? `Version ${version} is out.` : "Get the Chrome extension."}
        </h1>
        <p className="mt-3 max-w-2xl font-sans text-[13px] normal-case tracking-normal text-text-secondary">
          {from
            ? `You're on ${from}. Download the new version, unzip it over your current copy and reload it. It takes a minute, and your settings stay.`
            : "Save jobs, fill in applications and track them from LinkedIn, Indeed, Google Jobs and most careers sites."}
        </p>
      </header>

      <Section n="01" id="download" title="Download" i={1}>
        <Leader label="Latest version">{version}</Leader>
        <Leader label="Published">{publishedAt ? fmtDate(publishedAt) : "—"}</Leader>
        <div className="pt-5">
          {publishedAt ? (
            <Button asChild size="medium" className="uppercase" data-tour="extension-download">
              <a href="/extension/download" download>
                Download {version}
              </a>
            </Button>
          ) : (
            <p className="font-sans text-[13px] normal-case tracking-normal text-text-tertiary">
              No build has been published yet. Run <Code>npm run extension:publish</Code> to add one.
            </p>
          )}
        </div>
      </Section>

      {!from && (
        <Section n="02" id="install" title="Install" i={2}>
          <Steps
            steps={[
              <>Unzip the download into a folder you'll keep, like Documents/job-tracker-extension. Chrome runs the extension from that folder, so don't delete it.</>,
              <>
                Open <Code>chrome://extensions</Code> by pasting it into the address bar, and turn on Developer mode in the top right.
              </>,
              <>Click Load unpacked and pick the unzipped folder.</>,
              <>Pin it: click the puzzle piece in Chrome's toolbar, then the pin next to job-tracker.</>,
              <>Stay signed in here, in the same Chrome profile. The extension uses this session, so there's nothing to set up and no separate login.</>,
              <>Open any job listing. A job-tracker bar appears beside the apply button.</>,
            ]}
          />
        </Section>
      )}

      <Section n={from ? "02" : "03"} id="update" title="Update" i={3}>
        <Steps
          steps={[
            <>When a new version is out, the extension opens this page for you.</>,
            <>Download it and unzip it into the same folder as before, replacing the old files. Keeping the folder keeps your settings.</>,
            <>
              On <Code>chrome://extensions</Code>, click the reload arrow on job-tracker, then refresh any open job tabs.
            </>,
          ]}
        />
      </Section>
    </div>
  );
}
