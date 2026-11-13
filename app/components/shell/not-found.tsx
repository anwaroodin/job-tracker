import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { PageTitle } from "~/components/ui/terminal";
import { Wordmark } from "./wordmark";

export function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-bg-primary px-6 text-center font-sans">
      <Wordmark className="h-8 w-auto" />
      <PageTitle className="items-center" title="Page not found" sub="This page doesn't exist or has moved. Check the address, or head back to the main page." />
      <Button asChild className="h-9 px-3.5 font-sans text-[13.5px] normal-case tracking-normal">
        <Link to="/">
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={1.5} />
          Back to the main page
        </Link>
      </Button>
    </main>
  );
}
