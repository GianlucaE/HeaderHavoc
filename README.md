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

Layout:

| Path                   | Purpose                                                      |
|------------------------|--------------------------------------------------------------|
| `src/core/`            | Pure logic — no `chrome.*` at module scope, all unit tested  |
| `src/core/compile.ts`  | Config → `declarativeNetRequest` rules, plus a sync report   |
| `src/core/match.ts`    | Local glob/regex evaluation for the tester                   |
| `src/core/transfer.ts` | The only serialisation boundary (`toStored` / `fromStored`)  |
| `src/background/`      | Service worker: recompiles and applies rules, sets the badge |
| `src/ui/`              | Shared state, components, and the two surfaces               |
