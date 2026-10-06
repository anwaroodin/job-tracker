import { Download } from "lucide-react";
import { useRef } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";
import { contactLine } from "~/lib/cv";
import type { CoverLetter, Person } from "~/types/cv";

const SHEET = "bg-paper font-sans text-[13px] normal-case leading-relaxed tracking-normal text-paper-text";

function Paper({ title, children }: { title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const print = () => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute("data-printing", "");
    window.addEventListener("afterprint", () => el.removeAttribute("data-printing"), { once: true });
    window.print();
  };
  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="secondary" size="small" className="self-end uppercase" onClick={print}>
        <Download />
        Save {title} as PDF
      </Button>
      <div ref={ref} className={cn(SHEET, "px-8 py-9 sm:px-12")}>
        {children}
      </div>
    </div>
  );
}

function Header({ person }: { person: Person }) {
  return (
    <header>
      <h2 className="text-[22px] font-semibold">{person.name}</h2>
      <p className="mt-1 text-paper-muted">{contactLine(person)}</p>
    </header>
  );
}

export function CoverLetterDocument({ person, letter }: { person: Person; letter: CoverLetter }) {
  return (
    <Paper title="cover letter">
      <Header person={person} />
      <div className="mt-8 flex flex-col gap-4">
        <p>{letter.greeting}</p>
        {letter.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p className="whitespace-pre-line">{`${letter.signOff}\n${person.name}`}</p>
      </div>
    </Paper>
  );
}
