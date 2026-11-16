import { useSearchParams } from "react-router";
import type { Route } from "./+types/extension";
import { ChromeIcon, Download04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "~/components/ui/button";
import { PageSection, SANS_PAGE } from "~/components/ui/page-section";
import { SideBlock } from "~/components/ui/side-block";
import { PageTitle, shortDate, stagger } from "~/components/ui/terminal";
import { envContext } from "~/server/context.server";
import { EXTENSION_VERSION, publishedExtension } from "~/server/extension/download.server";

export async function loader({ context }: Route.LoaderArgs) {
  const publishedAt = await publishedExtension(context.get(envContext).CVS);
  return { version: EXTENSION_VERSION, publishedAt };
}


const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="whitespace-nowrap bg-ink/[0.06] px-1 font-mono text-[12.5px] text-text-primary">{children}</code>
);

function Steps({ steps }: { steps: { title: string; body: React.ReactNode }[] }) {
  return (
    <ol className="flex flex-col border border-stroke-secondary">
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-3 border-b border-stroke-secondary px-4 py-3.5 last:border-b-0">
          <span className="grid size-7 shrink-0 place-items-center bg-ink/[0.05] text-[12.5px] font-medium tabular-nums text-text-secondary">{i + 1}</span>
          <div className="min-w-0 pt-0.5">
            <p className="font-medium text-text-primary">{step.title}</p>
            <p className="mt-0.5 text-[13.5px] leading-relaxed text-text-secondary">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

const INSTALL = [
  { title: "Unzip it somewhere you'll keep", body: <>For example Documents/jb-extension. Chrome runs the extension from that folder, so don't delete it.</> },
  {
    title: "Turn on Developer mode",
    body: (
      <>
        Paste <Code>chrome://extensions</Code> into the address bar, then switch on Developer mode in the top right.
      </>
    ),
  },
  { title: "Load it", body: <>Click Load unpacked and pick the unzipped folder.</> },
  { title: "Pin it", body: <>Click the puzzle piece in Chrome's toolbar, then the pin next to j*b.</> },
  { title: "Stay signed in here", body: <>Use the same Chrome profile. The extension uses this session, so there's no separate login.</> },
  { title: "Open any job listing", body: <>A j*b bar appears beside the apply button. Click Save to track the job.</> },
];

const UPDATE = [
  { title: "Download the new version", body: <>When one is out, the extension opens this page for you.</> },
  { title: "Unzip it over the old files", body: <>Use the same folder as before and replace what's there. Keeping the folder keeps your settings.</> },
  {
    title: "Reload it",
    body: (
      <>
        On <Code>chrome://extensions</Code>, click the reload arrow on j*b, then refresh any open job tabs.
      </>
    ),
  },
];

export default function ExtensionPage({ loaderData }: Route.ComponentProps) {
  const { version, publishedAt } = loaderData;
  const from = useSearchParams()[0].get("from");

  return (
    <div className={`flex flex-col gap-10 ${SANS_PAGE}`}>
      <header className="rise" style={stagger(0)}>
        <PageTitle
          title={from ? `Version ${version} is out` : "Get the Chrome extension"}
          sub={
            from
              ? `You're on ${from}. Download the new version, unzip it over your current copy and reload it. It takes a minute, and your settings stay.`
              : "Save jobs, fill in applications and track them from LinkedIn, Indeed, Google Jobs and most careers sites."
          }
        />
      </header>

      <div className="rise grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12" style={stagger(1)}>
        <div className="flex min-w-0 flex-col gap-10">
          {!from && (
            <PageSection id="install" title="Install" description="Takes about two minutes, once.">
              <Steps steps={INSTALL} />
            </PageSection>
          )}
          <PageSection id="update" title="Update" description={from ? "Three steps and you're on the new version." : "When a new version comes out."}>
            <Steps steps={UPDATE} />
          </PageSection>
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-16 lg:self-start lg:border-l lg:border-stroke-secondary lg:pl-8">
          <SideBlock title="Download">
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center bg-ink/[0.05] text-text-secondary">
                <HugeiconsIcon icon={ChromeIcon} size={18} strokeWidth={1.5} />
              </span>
              <div className="min-w-0">
                <p className="font-medium text-text-primary">j*b for Chrome</p>
                <p className="text-[12.5px] text-text-tertiary">{publishedAt ? `Version ${version} · ${shortDate(publishedAt)}` : `Version ${version} · not published`}</p>
              </div>
            </div>
            {publishedAt ? (
              <Button asChild className="w-full" data-tour="extension-download">
                <a href="/extension/download" download>
                  <HugeiconsIcon icon={Download04Icon} size={16} strokeWidth={1.5} />
                  Download {version}
                </a>
              </Button>
            ) : (
              <p className="text-[13px] leading-relaxed text-text-tertiary">
                No build has been published yet. Run <Code>npm run extension:publish</Code> to add one.
              </p>
            )}
          </SideBlock>
          <SideBlock title="Works on">
            <p className="text-[13.5px] leading-relaxed text-text-secondary">LinkedIn, Indeed, Google Jobs, Workday, Greenhouse, Lever and most careers sites.</p>
          </SideBlock>
        </aside>
      </div>
    </div>
  );
}
