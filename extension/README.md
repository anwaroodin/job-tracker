# job-tracker extension

A Chrome extension that captures a job's details, fills the application form from your profile and logs the application to the dashboard in one click.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `extension/` folder.
3. Click the extension's icon and enter your dashboard's address (for example `https://job-tracker.<subdomain>.workers.dev`, or `localhost:5173` for `npm run dev`).
4. Sign in on the dashboard in the same Chrome profile. The extension uses that session; there is no separate login.

There's no build step. The popup and service worker are ES modules; content scripts are classic scripts that share `globalThis.__jobTracker` and load in the order listed in `manifest.json`.

After changing the extension, click reload on `chrome://extensions` and refresh open tabs.

### The dashboard address

The extension doesn't have a dashboard built in: each user points it at their own deployment. The address is asked for on first use and can be changed under **Settings** in the popup (or **Extension options** on `chrome://extensions`). Only the origin is kept, in `chrome.storage.sync`, and it must be `https://`, apart from `localhost` and `127.0.0.1` over plain http for development. `src/config.js` owns reading and checking it; nothing else hardcodes an address.

The bar stays off the dashboard itself: `main.js` compares the page's origin with the configured one.

## Usage

### Apply with job-tracker

On a job listing, a job-tracker bar sits beside the site's own apply controls (LinkedIn: at the right end of the Easy Apply / Save row; Indeed and Google Jobs: beside their Apply button; other sites: floating in the bottom-right corner, where × hides it for the current job). Left to right:

- **Status**: "Not tracked" or the application's status on the dashboard. Picking one tracks the job or updates it. **Saved** is a bookmark: it appears in its own Saved section on the Applications page (not in the records or stats) and becomes the application when you apply.
- **Bookmark / ★ Star**: flags the application. On an untracked or saved job it shows as a bookmark (and saves an untracked job as saved); once applied it shows as a star. The two are separate: applying to a bookmarked job clears the flag, so it becomes a plain application unless you star it. Flags show on the dashboard, and can be changed from the application's page there.
- **↗ Open**: the application on the dashboard (or the dashboard, when untracked).
- **⧉ Copy**: copies role, company, URL and the full description.
- **▾ Quick view**: posted date, applicant count, workplace, job type and salary when the page states them; the role and company (editable); CV and category.
- **Apply & fill**: described below.

Confirmations and the quick view open in the browser's top layer, so the site's own panels can't clip or cover them. Confirmations close themselves after a few seconds; errors stay until dismissed.

- **Apply & fill** tracks the application, then opens the job's application form and fills it:
  - an apply link opens in a new tab, which is filled when it loads;
  - an apply button is clicked for you, and the tab it opens (or the same tab, for in-page forms like LinkedIn Easy Apply) is filled;
  - a form on the listing itself is filled in place.

Filling keeps going as the form changes, so later steps of multi-step forms and forms embedded in iframes (Greenhouse and Lever embeds, for example) are filled too. A bar in the top-right corner shows the job, the count of filled fields and a **Stop** button. It stops on its own after two hours, or when you move the listing tab to another job.

The card shows on:

- LinkedIn, Google Jobs and Indeed when a job is open (including the detail pane on search pages)
- Pages with schema.org `JobPosting` data, which most careers sites and applicant tracking systems publish
- Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Workday, Teamtailor, BambooHR, Recruitee and similar hosted job pages

### What's saved with a job

Saving a job from the bar (bookmarking it, picking a status or Apply & fill) stores the listing so the dashboard can show it like the original posting:

- the description, with its headings and bullet points kept as light markup (`## ` headings, `• ` list items);
- the header facts: location, workplace, employment type, salary, when it was posted and the applicant count;
- on LinkedIn, the "People you can reach out to" (name, profile link, connection degree, headline and why LinkedIn suggests them).

Sites render some of this seconds after the job opens (LinkedIn's description, and its people section only once you scroll to it). The bar keeps watching the open job and sends anything new to the dashboard as it appears, so a job saved early still ends up complete.

### Popup

Click the extension icon on any page to capture and fill it by hand:

- **Target:** the detected company and role. Edit them before saving if they're wrong.
- **Config:** the CV variant (software or retail) and an optional category (grad, intern, junior). Both are detected from the job title and description and can be changed.
- **Fill & track** fills the form's empty fields and records the application with its URL, description, CV type and category.

When you come back in the popup to an application you've already tracked (the same URL, the same company and role, or another page on the same site within a few hours, for multi-step forms), the popup shows **Fill fields** instead, which fills without creating a second record. **This is a different job** clears that and tracks the page as a new application. The server also returns the existing record when the same URL or company and role was tracked in the last 30 days, so retries never duplicate.

## What gets filled

Fields are matched on their `autocomplete` attribute first, then their label, `aria-label`, placeholder, name and id.

| Profile | Fields |
| --- | --- |
| Personal | full, first and last name, email, phone |
| Address | lines 1 and 2, city, county/state, postcode, country |
| Links | LinkedIn, GitHub, portfolio or website |
| Eligibility | right to work, visa sponsorship (radios, checkboxes and yes/no selects), notice period or start date |
| CV variant | salary expectation, cover letter or "why this company", summary |

Text inputs, textareas, selects, radios, checkboxes and rich-text editors are supported. Values are set through the element's native setter and the `input`, `change` and `blur` events fire, so React and Vue forms register them. A field that already has a value, a radio group that's already answered and a select with an option already chosen are left alone.

Iframes are only filled when they contain at least three recognised fields, so ads and newsletter boxes on the page are left alone. Site search bars (inside `header`, `nav` or `role="search"`) are skipped, and when a dialog with form fields is open only the dialog is filled. A field is never filled twice, so clearing one sticks.

## Permissions and privacy

| Permission | Why |
| --- | --- |
| host: all sites | Show the card on job listings and fill application forms wherever they are hosted |
| `scripting`, `activeTab` | Let the popup run on tabs opened before the extension was installed |
| `storage` | Remember recently tracked applications on this device and which tabs are being applied to |

The content scripts make no network requests; everything goes through the service worker. They read the page to show the bar on job listings, and nothing about a job is sent until you save it from the bar. After that, opening the listing again keeps the saved job's details current (see "What's saved with a job"). On LinkedIn that includes the names, headlines and profile links of the people the listing suggests, which are stored in your own dashboard only. The service worker fetches your profile when a tab being applied to asks for values, and passes the values for the chosen CV to that tab only. The profile is never stored; the list of tabs being filled is kept in session storage and cleared when Chrome closes. Clicks on the bar are ignored unless they come from the user (`event.isTrusted`), and the bar lives in a closed shadow root that page scripts can't reach.

## Layout

```text
extension/
├── manifest.json            Content-script order lives here and in src/lib/page.js
├── icons/
└── src/
    ├── config.js            The user's dashboard origin: reading, checking and saving it
    ├── background.js        Service worker: API calls, tracking, pending-tab state
    ├── content/             Content scripts (classic scripts sharing globalThis.__jobTracker)
    │   ├── core.js          Namespace, DOM helpers, structured data, adapter registry
    │   ├── adapters/        One file per site: linkedin.js, indeed.js, google.js
    │   ├── capture.js       Adapter dispatch, generic job capture, apply target, quick facts
    │   ├── fill.js          Field recognition and form filling
    │   ├── ui.js            Element builder, icons, shared shadow-DOM stylesheet
    │   ├── autofill.js      Autofill loop and the top-right progress bar
    │   ├── bar.js           The action bar and quick view
    │   └── main.js          Entry point: starts autofill and the scan loop
    ├── lib/                 ES modules for the popup and service worker
    │   ├── api.js           /api/ext/* client
    │   ├── cv.js            CV variant and category detection
    │   ├── dashboard-form.js The dashboard address form (popup setup and options page)
    │   ├── page.js          Lets the popup inject the content library
    │   ├── profile.js       Profile → form values
    │   └── tracked.js       Recently tracked applications
    ├── options/             Options page: the dashboard address
    └── popup/
```

## Adding a site adapter

An adapter owns one site's DOM. Create `src/content/adapters/<site>.js`:

```js
(() => {
  "use strict";
  const JT = globalThis.__jobTracker;
  if (!JT || JT.adapters.some((a) => a.name === "mysite")) return;
  const { visible, visibleText } = JT.dom;

  // Every selector the adapter keys on, in one place.
  const SEL = { title: "...", company: "...", description: "...", apply: "..." };

  JT.register({
    name: "mysite",
    host: /(^|\.)mysite\.com$/,
    activeOn: (path) => path.startsWith("/jobs"),      // optional
    job: () => { /* { role, company, description, url } or null when no job is open */ },
    applyControl: () => visible(SEL.apply),
    anchor: () => ({ el: visible(SEL.apply), where: "afterend" }), // optional; defaults to after applyControl
    // Optional:
    // settling: () => true while an SPA is switching jobs (job() returns null meanwhile; the bar holds still)
    // contacts: () => [{ name, profileUrl, degree, headline, note }] people the listing suggests reaching out to
    // summaryText: () => the header text quick facts are read from; location: () => the job's location
  });
})();
```

Then add the file to `content_scripts.js` in `manifest.json` (after `core.js`, before `capture.js`) and to `PAGE_SCRIPTS` in `src/lib/page.js`.

Rules that keep adapters working when sites change:

- Key on stable hooks: ids, `aria-label`, `data-testid`, `componentkey` prefixes, `document.title`, URL patterns. Avoid generated class names.
- Scope page-wide queries away from list cards; search pages repeat controls like "More options" on every card.
- Return `null` from `job()` until the job is really open; the scan loop retries while the page renders. On single-page apps the URL often changes before the content does: check the rendered job matches the URL (by id where the site exposes one) before returning it.
- Descriptions often render lazily. Return what's there; the extension re-reads it and backfills the dashboard as more appears.
- Read descriptions with `JT.dom.richText(el)` rather than `innerText`, so headings and list items survive.

LinkedIn serves three layouts (classic side pane, `/jobs/view/`, `/jobs/search-results/`); `adapters/linkedin.js` documents how each is detected and anchored.

## Checking changes

Reload the extension on `chrome://extensions`, refresh the tab, and check:

- LinkedIn `/jobs/search-results/` with a job open and a `/jobs/view/<id>/` page: the bar sits on the Easy Apply row, the ▾ panel shows the right role and company, and switching between several jobs quickly updates it to the one open (never the previous one).
- Save a LinkedIn job before its description loads, then scroll to "People you can reach out to": the dashboard's page for it fills in the description and people.
- Indeed search with a job open, and Google Jobs (`udm=8`) with a job open.
- **Apply & fill** on an external-apply job opens the application and fills it; on LinkedIn Easy Apply the modal fills.
- A bookmark, a status change and Apply & fill on the same job all update one application, and the bookmark or star and status show on the dashboard.
- Signed out: the panel asks you to sign in and nothing is saved.
- No dashboard set (clear it from the service worker console with `chrome.storage.sync.clear()`): the popup asks for the address, and the bar's actions point to Set up.
- No errors in the page console or the service worker console.

## API

All endpoints use the dashboard's session cookie and return `401` when signed out.

| Endpoint | Use |
| --- | --- |
| `GET /api/ext/stats` | Checks the session and shows the tracked count (saved jobs aren't counted) |
| `GET /api/ext/profile` | The profile used to fill forms |
| `GET /api/ext/applications?url=&company=&role=` | The application tracked for a posting (an exact URL match first), or `null` |
| `POST /api/ext/applications` | Tracks a posting: `company` and `role` (required), `url`, `status`, `starred`, `cv_type`, `category`, `auto_filled` and the job details below. Returns `201` for a new record and `200` with `duplicate: true` for an existing one, which it updates |
| `PATCH /api/ext/applications/:id` | Updates `status`, `starred` (the bookmark/star flag) and any job details |

Job details: `description`, `location`, `work_type`, `employment_type`, `salary`, `posted_at` (ISO date), `applicants` and `contacts` (`[{ name, profileUrl, degree, headline, note }]`). Empty values are ignored, so a save made before the page finished rendering never blanks what an earlier one stored.

Requests with a body must be `application/json`; errors come back as `{ error: "<code>" }`.
