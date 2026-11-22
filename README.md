# HeaderHavoc

A Chrome extension (MV3) that injects or removes HTTP request and response headers on URLs matching glob or regex
patterns, grouped into profiles you can switch on and off.

## Install

```bash
npm install
npm run build
```

Then open `chrome://extensions`, turn on Developer mode, and **Load unpacked** → select `dist/`.

`npm run dev` rebuilds on save; hit the reload button on the extension card to pick up changes.

## Publishing

```bash
npm run package
```

This builds, then writes `header-havoc-<version>.zip` with `manifest.json` at the archive root, which is the layout
the Chrome Web Store expects. Upload that file at
[chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole) — a Google account and a
one-time $5 developer registration fee are required. The full release steps are in [RELEASE.md](RELEASE.md).

Draft listing copy, permission justifications, privacy answers, and a pre-upload checklist live in
[docs/store-listing.md](docs/store-listing.md).

**Bump the version before every upload.** The store rejects a version it has already seen. The number lives in
`public/manifest.json`, and `package.json` carries its own copy that names the zip — keep the two in step.

**Choose the right visibility.** Public listings are indexed and searchable. For a personal or team tool,
**Unlisted** (installable only by people with the link) or **Private** (named testers, or your Google Workspace
domain) is usually what you want, and it still gets you automatic updates without leaving Developer mode on.

**Expect questions about permissions.** `<all_urls>` plus header rewriting is a combination reviewers look at
closely, so the listing needs a clear, honest justification: the extension rewrites HTTP headers on URLs the
user configures, which cannot be narrowed ahead of time because the user supplies the patterns. Review usually
takes a few days and broad host permissions can extend that.

The listing also needs a description, at least one 1280×800 or 640×400 screenshot, and a privacy disclosure.
HeaderHavoc stores its configuration in `chrome.storage.local` and sends nothing anywhere, so the data-usage
form is a set of "no" answers — but it still has to be filled in.

### Sharing with co-workers

Check for a managed-extension policy first. On a work machine, open `chrome://policy` and look for
`ExtensionInstallBlocklist` and `ExtensionInstallAllowlist`. A blocklist containing `*` means only explicitly
allowlisted extensions can be installed, from the store or otherwise — that policy, not the packaging, is what
decides your options.

**No blocking policy** — publish an **Unlisted** store listing and send the link. One click to install, automatic
updates, no Developer mode. This is the best experience by a wide margin.

Unlisted is the visibility that works with a plain link. **Private** does not: it means either a hand-maintained
list of trusted-tester Google accounts, or restriction to a Google Workspace domain, which requires publishing
from an account in that domain. Unlisted is simply not indexed or searchable — anyone with the URL can install.

Nothing employer-specific is in the uploaded code; the sensitive part is your profiles, which live in
`chrome.storage.local` and move as an exported JSON file. Publish the extension, share the config privately.

**Allowlist-only policy** — publish Unlisted anyway to obtain a stable extension ID, then ask IT to add that one
ID to `ExtensionInstallAllowlist`. Adding an ID is a much smaller request than asking them to package and deploy
an extension themselves.

**Neither is possible** — share the zip from `npm run package`. Each person unzips it somewhere permanent, opens
`chrome://extensions`, turns on Developer mode, and uses **Load unpacked** on the unzipped folder. It works, but
updates are manual and the folder has to stay put or the extension breaks.

Whichever route, send an exported config alongside it. **Export** in the options page writes
`header-havoc-YYYY-MM-DD.json`; anyone who **Import**s that file gets the same profiles rather than retyping
patterns by hand.

### Installing without the store

Loading `dist/` unpacked (see Install above) works and needs no review, but Developer mode has to stay on and
Chrome will periodically warn about it. Self-hosted `.crx` files are not a real option: Chrome blocks
installing them outside the store except via enterprise policy.

## How matching works

Each profile holds URL patterns and headers. Every pattern in a profile shares that profile's headers. A pattern matches
in one of two modes:

- **glob** — `declarativeNetRequest` filter syntax. `*` matches any characters, `|` anchors the start or end, `||`
  anchors a domain, `^` matches a separator. A bare string is a substring match.
- **regex** — an RE2 expression matched against the whole URL. No backreferences or lookahead, and regex rules draw on a
  smaller Chrome quota.

A header with a value is **set**; a header with an empty value is **removed**. Rows and profiles both have toggles, so
you can park either without deleting it.

Every compiled rule explicitly matches all resource types including `main_frame` — omitting that is why header injection
appears to do nothing on a plain page load.

## Verifying a header is actually sent

Chrome's DevTools Network panel does not reliably show headers modified by `declarativeNetRequest`, in either
direction — it tends to show what the network stack saw before the rules ran. Verify against the wire instead, and note
that request and response headers need different checks.

**Request headers** — hit an echo endpoint such as `https://httpbin.org/headers`, which returns the request headers it
received, or check your server logs.

**Response headers** — an echo endpoint cannot help here; `httpbin.org/headers` reports the request only. Read the
header back from JavaScript instead, on a page whose URL your profile matches:

```js
fetch(location.href).then((r) => r.headers.get('x-your-header'));
```

Use a same-origin URL. On a cross-origin fetch the browser only lets script read CORS-safelisted response headers, so a
custom header comes back `null` even when the rule applied correctly — unless the response also carries
`Access-Control-Expose-Headers`.

### Example: stop a response being cached

A response-header rule changes how *your* browser treats a response that already arrived. Forcing `no-store`
is the most useful case — handy when a dev server keeps serving you a stale bundle.

Create a profile with your URL pattern and these headers, all with **Applies to: Response**:

| Name            | Value      | Effect                                                    |
|-----------------|------------|-----------------------------------------------------------|
| `cache-control` | `no-store` | tells the browser not to store the response at all         |
| `etag`          | *(empty)*  | removes the validator, so there is nothing to revalidate   |
| `last-modified` | *(empty)*  | same, for the date-based validator                         |

Remember that an empty value **removes** a header rather than setting it to nothing, which is what you want for
the two validators.

**Two caveats worth knowing before you rely on this:**

1. **Rules only run on requests that reach the network.** If Chrome answers from its cache without making a
   request, no rule runs — so this stops *future* caching rather than purging what is already cached. Clear the
   cache once when you start.
2. **Whether Chrome's HTTP cache honours the rewritten header is worth confirming for your own case.** The
   modification is applied as the response arrives, and the caching decision happens in the same layer, so
   ordering matters. The header definitely reaches page JavaScript; that it also changes cache behaviour is the
   part to verify.

Verify it with the echo server, which logs every request that actually reaches it:

```bash
npm run echo
```

Open `http://localhost:8787/echo?set-cache-control=max-age%3D300` — the server now claims the response is
cacheable for five minutes. Reload a few times and watch the terminal. No new log lines means Chrome is serving
from cache. Now enable a profile matching `localhost:8787` that sets `cache-control` to `no-store` on the
response, clear the cache once, and reload again. A log line on every reload means the rewrite is taking
effect.

The options page's Diagnostics panel also gives you:

- the compiled rule set and the rules Chrome matched recently,
- a URL tester that reports **Chrome's own verdict** (`testMatchOutcome`) alongside a per-pattern breakdown, so you can
  see which pattern of a profile matched.

The per-pattern breakdown evaluates regex with the JavaScript engine, which is close to but not identical to RE2.
Chrome's verdict is the authoritative one, and the tester says so.

## Config format

Profiles live in `chrome.storage.local` in exactly the same shape as the export file, so a config moves between
machines — or between this build and another — with no translation:

```json
{
  "enabled": true,
  "theme": "dark",
  "profiles": [
    {
      "id": "uuid",
      "name": "Staging",
      "enabled": true,
      "urlPatterns": [{ "value": "api.example.com", "mode": "glob" }],
      "headers": [
        { "name": "iv-user", "value": "someone", "enabled": true, "target": "request" }
      ]
    }
  ]
}
```

Export writes `header-havoc-YYYY-MM-DD.json`. Import replaces your profiles, and tolerates missing fields, unknown
fields, and key-case variants rather than failing.

Pattern and header rows also carry an `id` at runtime for DOM keying; it is generated on load and stripped on save, so
it never appears on disk.

## Development

```bash
npm test          # vitest, pure logic only — no browser needed
npm run typecheck
npm run preview:ui
```

`npm run preview:ui` serves the real options and popup pages against a stubbed `chrome.*` API (`dev/mock-chrome.ts`,
injected only by the dev server) so the UI can be worked on without installing the extension. None of it reaches
`dist/`.

`npm run echo` starts a dependency-free header echo server on port 8787 (`PORT=8788 npm run echo` to move it). It
shows the request headers it received and, via a same-origin fetch, the response headers **as the browser sees them** —
the only view that can show injected response headers. `?set-<name>=<value>` makes it send a header first, so you can
test overwriting and removing as well as adding.

`npm run icons` regenerates the toolbar PNGs from `dev/make-icons.mjs`.

`npm run shots` captures the store screenshots from the preview server, so `npm run preview:ui` must be running.
It drives headless Chrome and writes exact 1280×800 images to `docs/store-screenshots/`.

Layout:

| Path                   | Purpose                                                      |
|------------------------|--------------------------------------------------------------|
| `src/core/`            | Pure logic — no `chrome.*` at module scope, all unit tested  |
| `src/core/compile.ts`  | Config → `declarativeNetRequest` rules, plus a sync report   |
| `src/core/match.ts`    | Local glob/regex evaluation for the tester                   |
| `src/core/transfer.ts` | The only serialisation boundary (`toStored` / `fromStored`)  |
| `src/background/`      | Service worker: recompiles and applies rules, sets the badge |
| `src/ui/`              | Shared state, components, and the two surfaces               |
