# Chrome Web Store submission

Draft copy and answers for the developer dashboard. Start **Unlisted**; visibility can be switched to Public
later from the same listing, which keeps the extension ID and does not disturb existing installs.

## Listing

**Name:** HeaderHavoc

**Short description** (132 char limit). Two options — the first says what it does, the second leads with the
trust angle. Pick one:

> Inject or remove HTTP request and response headers on URLs you choose, grouped into profiles you toggle on and off.

(115 chars)

> Set or remove HTTP headers on URLs you choose. No network calls, no content scripts, no third-party code.

(105 chars)

**Category:** Developer Tools

**Detailed description:**

> HeaderHavoc rewrites HTTP headers on requests and responses for URLs you specify. It was built for
> developers who need to set headers against internal or staging services and want a tool whose behaviour
> they can reason about.
>
> **Built to stay out of the way**
>
> - No network requests of its own. The extension never calls home, and has no account, server, or analytics.
> - No third-party code. It ships with zero runtime dependencies, so there is no supply chain to compromise.
> - No content scripts. It never injects anything into the pages you visit and never reads their content.
> - Nothing is executed dynamically — no eval, no remotely loaded code.
> - Your configuration stays in local browser storage and is yours to export as a JSON file.
>
> It asks for broad host access for one reason: you supply the URL patterns, so the hosts cannot be known
> ahead of time. That access is used only to apply your header rules — nothing is read from the pages
> themselves.
>
> **What it does**
>
> - Group rules into profiles, and switch whole profiles on or off from the toolbar.
> - Match URLs by glob (declarativeNetRequest filter syntax) or by RE2 regular expression, chosen per pattern.
> - Set a header by giving it a value, or remove it by leaving the value empty.
> - Apply headers to the request, the response, or both.
> - Toggle individual header rows without deleting them, so you can keep variants around.
> - Export and import profiles as JSON to move a setup between machines or share it with a teammate.
>
> **Tells you when it is not working**
>
> Chrome's DevTools Network panel does not reliably show headers modified by declarativeNetRequest, which
> makes these rules unusually hard to debug. The options page includes diagnostics: the rules currently
> registered with Chrome, the rules Chrome matched recently, and a URL tester that reports Chrome's own match
> verdict next to a per-pattern breakdown showing exactly which pattern matched and which did not.

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

## Screenshots and upload

Screenshots are generated with `npm run shots`; the upload steps and the field-by-field mapping are in
[RELEASE.md](../RELEASE.md).
