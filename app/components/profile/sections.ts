export const SECTIONS = [
  {
    n: "02",
    id: "personal",
    title: "Personal information",
    description: "Your name and how employers reach you.",
  },
  {
    n: "03",
    id: "address",
    title: "Address",
    description: "Used for postal fields on applications.",
  },
  {
    n: "04",
    id: "links",
    title: "Links",
    description: "Attached to auto-filled applications.",
  },
  {
    n: "05",
    id: "eligibility",
    title: "Work eligibility",
    description: "Right to work, sponsorship, availability and pay.",
  },
  {
    n: "06",
    id: "integrations",
    title: "Integrations",
    description: "Third-party services connected to your account.",
  },
] as const;
export const secN = (id: string) => SECTIONS.find((s) => s.id === id)!.n;
