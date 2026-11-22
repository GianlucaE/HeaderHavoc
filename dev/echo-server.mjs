/** Header echo server for checking injected headers — `npm run echo`, then open http://localhost:8787. */
import {createServer} from 'node:http';

const PORT = Number(process.env.PORT ?? 8787);

function baselineHeaders(url) {
    const headers = {};
    for (const [key, value] of url.searchParams) {
        if (key.toLowerCase().startsWith('set-')) {
            headers[key.slice(4)] = value;
        }
    }
    return headers;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

function rows(headers) {
    const names = Object.keys(headers).sort();
    if (names.length === 0) {
        return '<tr><td colspan="2" class="empty">none</td></tr>';
    }
    return names
        .map((name) => `<tr><th>${escapeHtml(name)}</th><td>${escapeHtml(headers[name])}</td></tr>`)
        .join('');
}

function page(req) {
    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <title>Header echo</title>
    <style>
        :root { color-scheme: dark; }
        body {
            margin: 0; padding: 24px; background: #2a2a2a; color: #ededed;
            font: 14px ui-sans-serif, system-ui, sans-serif;
        }
        main { max-width: 900px; margin: 0 auto; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        h2 { font-size: 14px; margin: 24px 0 8px; }
        p.note { color: #a9a9a9; margin: 0 0 8px; }
        table {
            width: 100%; border-collapse: collapse; background: #313131;
            border: 1px solid #454545; border-radius: 3px; overflow: hidden;
        }
        th, td {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 12.5px; text-align: left; padding: 6px 10px;
            border-bottom: 1px solid #3a3a3a; word-break: break-all;
        }
        th { color: #4d7cff; width: 260px; font-weight: 500; }
        td.empty { color: #8a8a8a; font-style: italic; }
        button {
            font: inherit; background: #4d7cff; color: #10131a; font-weight: 600;
            border: none; border-radius: 3px; padding: 6px 12px; cursor: pointer;
        }
    </style>
</head>
<body>
<main>
    <h1>Header echo</h1>
    <p class="note">Point a HeaderHavoc profile at <code>localhost:${PORT}</code>, then reload.</p>

    <h2>1 · Request headers on this page load <span style="color:#8a8a8a">(resource type: main_frame)</span></h2>
    <p class="note">Rendered by the server. Your injected <strong>request</strong> headers show up here.</p>
    <table>${rows(req.headers)}</table>

    <h2>2 · A fetch from this page <span style="color:#8a8a8a">(resource type: xmlhttprequest)</span></h2>
    <p class="note">
        Request headers echoed back by the server, then the <strong>response</strong> headers as the browser
        sees them — this is the only view that can show injected response headers.
    </p>
    <p><button id="refresh">Run fetch again</button></p>
    <h2 style="margin-top:12px">Request headers the server received</h2>
    <table id="fetch-request"><tr><td colspan="2" class="empty">running…</td></tr></table>
    <h2>Response headers the browser received</h2>
    <table id="fetch-response"><tr><td colspan="2" class="empty">running…</td></tr></table>
</main>
<script type="module">
    const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const render = (el, pairs) => {
        el.innerHTML = pairs.length === 0
            ? '<tr><td colspan="2" class="empty">none</td></tr>'
            : pairs.map(([k, v]) => \`<tr><th>\${esc(k)}</th><td>\${esc(v)}</td></tr>\`).join('');
    };

    async function run() {
        const res = await fetch(\`/echo?t=\${Date.now()}\${location.search.replace('?', '&')}\`, {cache: 'no-store'});
        const body = await res.json();
        render(document.getElementById('fetch-request'), Object.entries(body.headers).sort());
        render(document.getElementById('fetch-response'), [...res.headers].sort());
    }

    document.getElementById('refresh').addEventListener('click', run);
    run();
</script>
</body>
</html>`;
}

const server = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const extra = baselineHeaders(url);

    // never cache: a replayed response would not re-run the extension's rules
    res.setHeader('Cache-Control', 'no-store, max-age=0');

    for (const [name, value] of Object.entries(extra)) {
        res.setHeader(name, value);
    }

    console.log(`${req.method} ${url.pathname} — ${Object.keys(req.headers).length} request headers`);

    if (url.pathname === '/echo') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({method: req.method, url: req.url, headers: req.headers}, null, 2));
        return;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(page(req));
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use — another echo server is probably running.`);
        console.error(`Stop it, or pick another port:  PORT=8788 npm run echo`);
        process.exit(1);
    }
    throw err;
});

server.listen(PORT, () => {
    console.log(`Header echo listening on http://localhost:${PORT}`);
    console.log('Point a HeaderHavoc profile at localhost and reload the page.');
});
