export interface LessonStep {
  title: string;
  body: string;
  path?: string;
  target?: string;
  click?: boolean;
}

export interface Lesson {
  title: string;
  blurb: string;
  steps: LessonStep[];
}

export const LESSONS = {
  gmail: {
    title: "Connect Gmail",
    blurb: "Let your inbox fill in the tracker for you.",
    steps: [
      {
        title: "Your inbox does the logging",
        body: "Once Gmail is connected, job-tracker reads your job emails (read-only), works out which application each one belongs to and moves its status along: applied, interview, offer, rejected.",
      },
      {
        path: "/profile",
        target: "#integrations",
        title: "Connect it here",
        body: "Integrations on your profile holds the Gmail connection. Connect asks Google for read-only access, nothing is ever sent or deleted.",
      },
      {
        target: "[data-tour=sync]",
        title: "Watch it sync",
        body: "The sidebar shows each sync as it runs: checking the inbox, downloading, classifying, reading details. It runs on its own in the background.",
      },
      {
        path: "/settings",
        target: "#gmail",
        title: "Tune what it reads",
        body: "Turn auto-sync off, sync by hand, or change how sure the classifier must be before it acts on an email.",
      },
      {
        path: "/applications",
        title: "Emails it isn't sure about",
        body: "When an email might be about a job but the classifier isn't confident, the From Gmail box at the top of Applications asks you to confirm it. Nothing unsure is acted on without you.",
      },
    ],
  },
  tour: {
    title: "Take the tour",
    blurb: "The pages, search, and where things live.",
    steps: [
      {
        path: "/overview",
        target: "[data-tour=nav]",
        title: "Your workspace",
        body: "Overview is the readout, Applications is every job you're tracking, CV is your master CV and the tailored ones, Profile holds what the extension fills into forms.",
      },
      {
        target: "[data-tour=search]",
        title: "Search everything",
        body: "Jump to any job, email or page from here, or press Ctrl+K (⌘K on a Mac) anywhere.",
      },
      {
        path: "/applications",
        title: "Applications",
        body: "Every application with its status, emails and timeline. Open one to see the full history or change its status by hand.",
      },
      {
        path: "/overview",
        title: "That's the tour",
        body: "Lessons stay in the sidebar until you've done them all, and in search any time.",
      },
    ],
  },
  extension: {
    title: "Use the extension",
    blurb: "Save jobs and fill applications from any job board.",
    steps: [
      {
        title: "Track jobs where you find them",
        body: "The Chrome extension adds a bar to job listings on LinkedIn, Indeed, Google Jobs and most careers sites. One click saves the job, tracks your application or fills in the form from your profile.",
      },
      {
        path: "/profile",
        target: "[data-tour=extension-setup]",
        click: true,
        title: "Find it on your profile",
        body: "Integrations on your profile has the extension next to Gmail. Click Set up.",
      },
      {
        target: "[data-tour=extension-download]",
        title: "Download it",
        body: "This page always has the latest build. Download the zip and unzip it into a folder you'll keep, since Chrome runs the extension from there.",
      },
      {
        target: "#install",
        title: "Install it",
        body: "Open chrome://extensions, turn on Developer mode, click Load unpacked and pick the unzipped folder. It uses the session you're signed in with here, so there's nothing to set up.",
      },
      {
        path: "/applications",
        target: "[data-tour=saved]",
        title: "Saved jobs land here",
        body: "Bookmarking a listing puts it under Saved. It becomes an application once you apply.",
      },
      {
        path: "/profile",
        target: "#personal",
        title: "What it fills in",
        body: "Apply & fill uses your profile: name, contact details, address, links and work eligibility. Keep it current and forms fill themselves.",
      },
    ],
  },
  tailoring: {
    title: "Tailor a CV",
    blurb: "Rewrite your CV for a job, keeping only what's true.",
    steps: [
      {
        path: "/cv",
        target: "[data-tour=edit-cv]",
        click: true,
        title: "Start from your CV",
        body: "Every tailored CV is rewritten from your master CV, so get that right first. Click Edit CV to open it.",
      },
      {
        target: "#import",
        title: "Import what you have",
        body: "Drop in an existing CV and this page fills itself in. Check it over afterwards.",
      },
      {
        target: "#projects",
        title: "Keep more than fits",
        body: "List every project, not just the ones on your CV today. Tailoring pulls in the reserve ones when a job asks for them.",
      },
      {
        target: "#answers",
        title: "What you've told it",
        body: "Before tailoring, you're asked about skills a job wants that your CV doesn't show. Your answers are kept here and count as evidence next time.",
      },
      {
        target: "[data-tour=done-cv]",
        click: true,
        title: "Back to the overview",
        body: "Save your changes if you made any, then click Done.",
      },
      {
        target: "#tailored",
        title: "One CV per job",
        body: "Tailoring reads the job description and rewrites the CV around what it asks for, using only what your CV and answers back up. Each run is kept as a new version.",
      },
      {
        target: "#roles",
        title: "No job description?",
        body: "Tailor to a job title instead and you get a CV for a typical posting of that role.",
      },
      {
        path: "/applications",
        title: "Tailor from any application",
        body: "Each application has a Tailor link, and the extension's Tailor button saves a job and opens it straight away.",
      },
      {
        title: "It runs on your machine",
        body: "Tailoring runs through the local runner on your own Claude subscription. The tailoring page tells you when the runner isn't reachable.",
      },
    ],
  },
} satisfies Record<string, Lesson>;

export type LessonId = keyof typeof LESSONS;

export const LESSON_IDS = Object.keys(LESSONS) as LessonId[];

export const isLessonId = (id: string): id is LessonId => Object.hasOwn(LESSONS, id);
