# Chrome Web Store submission

Draft copy and answers for the developer dashboard. Start **Unlisted**; visibility can be switched to Public
later from the same listing, which keeps the extension ID and does not disturb existing installs.

## Listing

**Name:** HeaderHavoc

**Short description** (132 char limit — this is 118):

> Inject or remove HTTP request and response headers on URLs you choose, grouped into profiles you toggle on and off.

**Category:** Developer Tools

**Detailed description:**

> HeaderHavoc rewrites HTTP headers on requests and responses for URLs you specify.
>
> Group your rules into profiles and switch them on or off from the toolbar. Each profile holds one or more URL
> patterns and the headers to apply to them.
>
> - Match URLs by glob (declarativeNetRequest filter syntax) or by RE2 regular expression, chosen per pattern.
> - Set a header by giving it a value, or remove it by leaving the value empty.
> - Apply headers to the request, the response, or both.
> - Toggle individual header rows or whole profiles without deleting anything.
> - Export and import your profiles as JSON to move them between machines.
>
> Because Chrome's DevTools Network panel does not reliably show headers modified by declarativeNetRequest, the
> options page includes a diagnostics panel: it lists the rules currently registered with Chrome, the rules
> Chrome matched recently, and a URL tester that reports Chrome's own match verdict alongside a per-pattern
> breakdown showing which of a profile's patterns matched.
>
> Your configuration is stored locally in the browser. HeaderHavoc has no account, no server, and sends no data
> anywhere.

## Single purpose

> Modify HTTP request and response headers for URLs the user configures.

## Permission justifications

**declarativeNetRequest** — The extension's core function. Registers the dynamic rules that add or remove
headers on the URL patterns the user has configured.

**declarativeNetRequestFeedback** — Powers the diagnostics panel on the options page, which shows which rules
are currently registered and which ones Chrome matched. Header modifications are invisible in DevTools, so
without this the user has no way to tell a broken pattern from a working one. Used only in the options page and
never on page content.

**storage** — Stores the user's profiles locally via chrome.storage.local. Nothing is transmitted.

**Host permission `<all_urls>`** — The user supplies the URL patterns at runtime, so the set of hosts cannot be
known in advance and cannot be narrowed at install time. The extension injects no content scripts, reads no page
content, and inspects no response bodies; the permission is used solely so declarativeNetRequest rules can apply
to whatever URLs the user configures.

## Privacy / data usage

Every data-collection category is **No**. HeaderHavoc does not collect, transmit, or sell user data. The
configuration the user creates stays in `chrome.storage.local` on their own machine. Header values the user
enters never leave the browser except as part of the HTTP requests the user configured them for.

A privacy policy URL is required for some categories; if prompted, state that no data is collected.

## Screenshots

At least one 1280×800 or 640×400 image is required.

1. `npm run preview:ui` and open `http://localhost:5173/options.html` (this uses sample profiles, so no internal
   hostnames appear), or open the real options page with throwaway profiles.
2. Open DevTools, toggle the device toolbar, and set a responsive viewport of exactly 1280×800.
3. DevTools menu → Run command → "Capture screenshot".

Good subjects: the options page with a profile expanded, and the diagnostics panel after running a URL test.

**Check every screenshot for internal hostnames or real usernames before uploading.**

## Before each upload

- [ ] Bump `version` in `public/manifest.json` (the store rejects a version it has already accepted)
- [ ] Match the version in `package.json`, which names the zip
- [ ] `npm test` and `npm run build` are clean
- [ ] `npm run package`
- [ ] Upload `header-havoc-<version>.zip`
