/** Store promo video — `npm run video`, with `npm run preview:ui` running. */
import {spawn, spawnSync} from 'node:child_process';
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = 'docs/store-screenshots/demo.mp4';
const FRAMES = `${process.env.TMPDIR ?? '/tmp'}/hh-frames`;
const WIDTH = 1280;
const HEIGHT = 800;
const FPS = 20;
const PORT = 9334;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const OVERLAY_CSS = `
    #demo-cursor {
      position: fixed; left: 0; top: 0; width: 20px; height: 20px; margin: -10px 0 0 -10px;
      border-radius: 50%; background: rgba(255,255,255,.92);
      box-shadow: 0 0 0 2px rgba(0,0,0,.45), 0 2px 10px rgba(0,0,0,.5);
      z-index: 2147483000; opacity: 0; pointer-events: none;
      transform: translate(640px, 400px);
    }
    #demo-cursor.show { opacity: 1; }
    #demo-cursor::after {
      content: ''; position: absolute; inset: -6px; border-radius: 50%;
      border: 2px solid #4d7cff; opacity: 0; transform: scale(.5);
    }
    #demo-cursor.tap::after { animation: demo-tap .45s ease-out; }
    @keyframes demo-tap {
      0% { opacity: .9; transform: scale(.5); }
      100% { opacity: 0; transform: scale(2.1); }
    }
    #demo-scrim {
      position: fixed; left: 0; right: 0; bottom: 0; height: 190px; z-index: 2147482000;
      background: linear-gradient(to top, rgba(20,20,20,.96) 28%, rgba(20,20,20,0));
      opacity: 0; transition: opacity .35s ease; pointer-events: none;
    }
    #demo-scrim.show { opacity: 1; }
    #demo-caption {
      position: fixed; left: 0; right: 0; bottom: 46px; z-index: 2147483100;
      text-align: center; padding: 0 80px; pointer-events: none;
      font: 600 27px/1.35 ui-sans-serif, system-ui, -apple-system, sans-serif;
      color: #f2f5fb; letter-spacing: -0.01em;
      opacity: 0; transform: translateY(10px); transition: opacity .35s ease, transform .35s ease;
      text-shadow: 0 2px 14px rgba(0,0,0,.75);
    }
    #demo-caption.show { opacity: 1; transform: translateY(0); }
    #demo-caption b { color: #87a9ff; font-weight: 600; }
    #demo-title {
      position: fixed; inset: 0; z-index: 2147483600; background: #242424;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 18px; opacity: 0; transition: opacity .5s ease; pointer-events: none;
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    }
    #demo-title.show { opacity: 1; }
    #demo-title .mark {
      font: 700 60px/1 ui-sans-serif, system-ui, sans-serif; color: #4d7cff; letter-spacing: -.02em;
    }
    #demo-title .sub { font-size: 23px; color: #c9d2e3; font-weight: 500; }
    #demo-title .points {
      margin-top: 10px; display: flex; gap: 26px; font-size: 16px; color: #9aa6bd;
    }
`;

const OVERLAY = String.raw`(() => {
  if (window.__demo) { return; }
  const style = document.createElement('style');
  style.textContent = ${JSON.stringify(OVERLAY_CSS)};
  document.head.append(style);

  const layer = document.createElement('div');
  layer.innerHTML =
    '<div id="demo-scrim"></div><div id="demo-cursor"></div><div id="demo-caption"></div>' +
    '<div id="demo-title"><div class="mark">HeaderHavoc</div>' +
    '<div class="sub"></div><div class="points"></div></div>';
  document.body.append(layer);

  const $ = (id) => document.getElementById(id);

  window.__demo = {
    caption(text) {
      const el = $('demo-caption');
      el.innerHTML = text || '';
      el.classList.toggle('show', Boolean(text));
      $('demo-scrim').classList.toggle('show', Boolean(text));
    },
    moveTo(selector, ms) {
      const node = document.querySelector(selector);
      if (!node) { return; }
      const box = node.getBoundingClientRect();
      const cursor = $('demo-cursor');
      cursor.classList.add('show');
      cursor.style.transition = 'transform ' + ms + 'ms cubic-bezier(.33,0,.2,1)';
      cursor.style.transform =
        'translate(' + (box.left + box.width / 2) + 'px,' + (box.top + box.height / 2) + 'px)';
    },
    center(selector) {
      const el = document.querySelector(selector);
      if (!el) { return; }
      const box = el.getBoundingClientRect();
      const absTop = box.top + window.scrollY;
      const top = box.height > 520 ? absTop - 70 : absTop + box.height / 2 - 310;
      window.scrollTo({top: Math.max(0, top), behavior: 'smooth'});
    },
    click(selector) {
      const cursor = $('demo-cursor');
      cursor.classList.add('tap');
      setTimeout(() => cursor.classList.remove('tap'), 460);
      document.querySelector(selector)?.click();
    },
    title(sub, points) {
      $('demo-title').querySelector('.sub').textContent = sub;
      $('demo-title').querySelector('.points').innerHTML =
        (points || []).map((p) => '<span>' + p + '</span>').join('');
      $('demo-title').classList.add('show');
    },
    hideTitle() { $('demo-title').classList.remove('show'); },
  };
})()`;

const TEST_URL = 'https://orders-proxy-dev.apps.example.com/api/v1/dispatch';
const d = (expr) => `window.__demo.${expr}`;
const seq = (...calls) => calls.join(';');

const CARD = '[data-profile="d4"]';
const steps = [
    {js: d(`title('HTTP header rules you can actually debug', [])`), hold: 500},
    {hold: 2300},
    {js: d(`hideTitle()`), hold: 900},

    {js: seq(d(`caption('Group your header rules into <b>profiles</b>')`), d(`center('#profiles')`)), hold: 2500},

    {js: seq(d(`caption('Each card shows the header it sets, so you can tell them apart')`), d(`moveTo('[data-profile="a1"] .profile-summary .mono', 650)`)), hold: 2600},

    {js: seq(d(`caption('Filter a long list by name or URL')`), d(`moveTo('#filter', 600)`)), hold: 700},
    ...['a', 'd', 'm', 'i', 'n'].map((_, i) => ({
        js: `(() => { const el = document.getElementById('filter');
              el.value = 'admin'.slice(0, ${i + 1}); el.dispatchEvent(new Event('input', {bubbles: true})); })()`,
        hold: 150,
    })),
    {hold: 1700},
    {
        js: `(() => { const el = document.getElementById('filter');
              el.value = ''; el.dispatchEvent(new Event('input', {bubbles: true})); })()`,
        hold: 1100,
    },

    {js: seq(d(`caption('Switch a whole profile on or off')`), d(`moveTo('[data-profile="a1"] [data-action="toggle-profile"]', 650)`)), hold: 850},
    {js: d(`click('[data-profile="a1"] [data-action="toggle-profile"]')`), hold: 1900},
    {js: seq(d(`caption('The blue rail marks every profile that is live')`)), hold: 2200},
    {js: d(`click('[data-profile="a1"] [data-action="toggle-profile"]')`), hold: 1400},

    {js: seq(d(`caption('Duplicate one to spin up a variant')`), d(`moveTo('[data-profile="b2"] [data-action="duplicate"]', 600)`)), hold: 800},
    {js: d(`click('[data-profile="b2"] [data-action="duplicate"]')`), hold: 2300},
    {js: d(`caption('Copies start switched off, so they never clash with the original')`), hold: 2400},
    {js: seq(d(`caption('And every delete can be undone')`), d(`moveTo('[data-profile=\"b2\"] + .profile [data-action="delete"]', 600)`)), hold: 800},
    {js: seq(d(`click('[data-profile=\"b2\"] + .profile [data-action="delete"]')`), d(`caption('')`)), hold: 1300},
    {js: d(`moveTo('#toast .toast-action', 550)`), hold: 700},
    {js: d(`click('#toast .toast-action')`), hold: 1500},

    {js: seq(d(`caption('Each profile holds URL patterns and headers')`), d(`moveTo('${CARD} [data-action="expand"]', 600)`)), hold: 800},
    {js: d(`click('${CARD} [data-action="expand"]')`), hold: 600},
    {js: d(`center('${CARD}')`), hold: 2200},

    {js: seq(d(`caption('Match by <b>glob</b> — or switch a pattern to <b>RE2 regex</b>')`), d(`moveTo('${CARD} .chip', 600)`)), hold: 1500},
    {js: d(`click('${CARD} .chip')`), hold: 1900},
    {js: d(`click('${CARD} .chip')`), hold: 1300},

    {js: seq(d(`caption('Give a header a value to <b>set</b> it')`), d(`moveTo('${CARD} [data-field="header-value"]', 600)`)), hold: 2400},
    {
        js: `(() => { const el = document.querySelector('${CARD} [data-field="header-value"]');
              el.value = ''; el.dispatchEvent(new Event('input', {bubbles: true})); })();` +
            d(`caption('Leave it empty to <b>remove</b> that header instead')`),
        hold: 2700,
    },
    {
        js: `(() => { const el = document.querySelector('${CARD} [data-field="header-value"]');
              el.value = 'jdoe'; el.dispatchEvent(new Event('input', {bubbles: true})); })()`,
        hold: 900,
    },

    {js: seq(d(`caption('Apply it to the request, the response, or both')`), d(`moveTo('${CARD} .select-target', 600)`)), hold: 2500},

    {js: seq(d(`caption('New profiles tell you what they still need')`), d(`moveTo('#add-profile', 600)`)), hold: 800},
    {js: d(`click('#add-profile')`), hold: 500},
    {js: d(`center('#profiles > .profile:last-child')`), hold: 2200},
    {js: `(() => { const el = document.querySelector('#profiles > .profile:last-child [data-field="name"]'); el.value = 'S'; el.dispatchEvent(new Event('input', {bubbles: true})); })()`, hold: 60},
    {js: `(() => { const el = document.querySelector('#profiles > .profile:last-child [data-field="name"]'); el.value = 'St'; el.dispatchEvent(new Event('input', {bubbles: true})); })()`, hold: 60},
    {js: `(() => { const el = document.querySelector('#profiles > .profile:last-child [data-field="name"]'); el.value = 'Sta'; el.dispatchEvent(new Event('input', {bubbles: true})); })()`, hold: 60},
    {js: `(() => { const el = document.querySelector('#profiles > .profile:last-child [data-field="name"]'); el.value = 'Stag'; el.dispatchEvent(new Event('input', {bubbles: true})); })()`, hold: 60},
    {js: `(() => { const el = document.querySelector('#profiles > .profile:last-child [data-field="name"]'); el.value = 'Stagi'; el.dispatchEvent(new Event('input', {bubbles: true})); })()`, hold: 60},
    {js: `(() => { const el = document.querySelector('#profiles > .profile:last-child [data-field="name"]'); el.value = 'Stagin'; el.dispatchEvent(new Event('input', {bubbles: true})); })()`, hold: 60},
    {js: `(() => { const el = document.querySelector('#profiles > .profile:last-child [data-field="name"]'); el.value = 'Staging'; el.dispatchEvent(new Event('input', {bubbles: true})); })()`, hold: 60},
    {js: d(`moveTo('#profiles > .profile:last-child [data-field="pattern"]', 450)`), hold: 500},
    {js: `(() => { const el = document.querySelector('#profiles > .profile:last-child [data-field="pattern"]'); el.value = 'sta'; el.dispatchEvent(new Event('input', {bubbles: true})); })()`, hold: 60},
    {js: `(() => { const el = document.querySelector('#profiles > .profile:last-child [data-field="pattern"]'); el.value = 'stagin'; el.dispatchEvent(new Event('input', {bubbles: true})); })()`, hold: 60},
    {js: `(() => { const el = document.querySelector('#profiles > .profile:last-child [data-field="pattern"]'); el.value = 'staging.e'; el.dispatchEvent(new Event('input', {bubbles: true})); })()`, hold: 60},
    {js: `(() => { const el = document.querySelector('#profiles > .profile:last-child [data-field="pattern"]'); el.value = 'staging.exam'; el.dispatchEvent(new Event('input', {bubbles: true})); })()`, hold: 60},
    {js: `(() => { const el = document.querySelector('#profiles > .profile:last-child [data-field="pattern"]'); el.value = 'staging.example'; el.dispatchEvent(new Event('input', {bubbles: true})); })()`, hold: 60},
    {js: `(() => { const el = document.querySelector('#profiles > .profile:last-child [data-field="pattern"]'); el.value = 'staging.example.co'; el.dispatchEvent(new Event('input', {bubbles: true})); })()`, hold: 60},
    {js: `(() => { const el = document.querySelector('#profiles > .profile:last-child [data-field="pattern"]'); el.value = 'staging.example.com'; el.dispatchEvent(new Event('input', {bubbles: true})); })()`, hold: 60},
    {js: d(`moveTo('#profiles > .profile:last-child [data-field="header-name"]', 450)`), hold: 500},
    {js: `(() => { const el = document.querySelector('#profiles > .profile:last-child [data-field="header-name"]'); el.value = 'iv'; el.dispatchEvent(new Event('input', {bubbles: true})); })()`, hold: 60},
    {js: `(() => { const el = document.querySelector('#profiles > .profile:last-child [data-field="header-name"]'); el.value = 'iv-u'; el.dispatchEvent(new Event('input', {bubbles: true})); })()`, hold: 60},
    {js: `(() => { const el = document.querySelector('#profiles > .profile:last-child [data-field="header-name"]'); el.value = 'iv-use'; el.dispatchEvent(new Event('input', {bubbles: true})); })()`, hold: 60},
    {js: `(() => { const el = document.querySelector('#profiles > .profile:last-child [data-field="header-name"]'); el.value = 'iv-user'; el.dispatchEvent(new Event('input', {bubbles: true})); })()`, hold: 60},
    {js: d(`caption('…and go live the moment they are filled in')`), hold: 2600},
    {js: seq(d(`caption('Export and import profiles as JSON to share a setup')`), d(`center('.explainer')`), d(`moveTo('#export', 700)`)), hold: 2600},

    {js: seq(d(`caption('DevTools will not show these changes. So HeaderHavoc shows you.')`), d(`center('.diagnostics')`)), hold: 2700},
    {js: seq(d(`caption('See how many rules Chrome is actually enforcing')`), d(`moveTo('#sync-line', 600)`)), hold: 2400},

    {js: seq(d(`caption('Then test any URL against your rules')`), d(`moveTo('#test-url', 550)`)), hold: 800},
    ...Array.from({length: Math.ceil(TEST_URL.length / 3)}, (_, i) => ({
        js: `document.getElementById('test-url').value = ${JSON.stringify(TEST_URL)}.slice(0, ${(i + 1) * 3})`,
        hold: 55,
    })),
    {js: d(`moveTo('#test-run', 450)`), hold: 650},
    {js: d(`click('#test-run')`), hold: 1400},
    {js: seq(d(`caption("Chrome's own verdict — and exactly which pattern matched")`), d(`center('#output')`)), hold: 4200},

    {
        page: 'popup.html',
        js: `document.body.style.margin='0 auto';document.documentElement.style.padding='36px 0';` +
            `document.documentElement.style.background='#1f1f1f';` + d(`caption('Switch profiles from the toolbar')`),
        hold: 2200,
    },
    {js: seq(d(`caption('The same editor, in the popup')`), d(`moveTo('${CARD} [data-action="expand"]', 600)`)), hold: 700},
    {js: d(`click('${CARD} [data-action="expand"]')`), hold: 2600},

    {js: seq(d(`caption('')`), d(`title('Local only. Nothing phones home.', ['No network calls', 'No content scripts', 'No third-party code'])`)), hold: 3600},
];

class Cdp {
    constructor(socket) {
        this.socket = socket;
        this.nextId = 0;
        this.pending = new Map();
        socket.addEventListener('message', (event) => {
            const msg = JSON.parse(event.data);
            const entry = this.pending.get(msg.id);
            if (entry === undefined) { return; }
            this.pending.delete(msg.id);
            msg.error ? entry.reject(new Error(JSON.stringify(msg.error))) : entry.resolve(msg.result);
        });
    }

    send(method, params = {}, sessionId) {
        const id = ++this.nextId;
        const payload = {id, method, params};
        if (sessionId !== undefined) { payload.sessionId = sessionId; }
        this.socket.send(JSON.stringify(payload));
        return new Promise((resolve, reject) => this.pending.set(id, {resolve, reject}));
    }
}

async function waitForDevtools() {
    for (let i = 0; i < 60; i++) {
        try {
            const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
            return (await res.json()).webSocketDebuggerUrl;
        } catch {
            await sleep(250);
        }
    }
    throw new Error('Chrome did not expose a DevTools endpoint');
}

async function main() {
    rmSync(FRAMES, {recursive: true, force: true});
    mkdirSync(FRAMES, {recursive: true});

    const chrome = spawn(CHROME, [
        '--headless=new',
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${process.env.TMPDIR ?? '/tmp'}/hh-video`,
        `--window-size=${WIDTH},${HEIGHT}`,
        '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    ], {stdio: 'ignore'});

    let frame = 0;
    try {
        const socket = new WebSocket(await waitForDevtools());
        await new Promise((resolve, reject) => {
            socket.addEventListener('open', resolve, {once: true});
            socket.addEventListener('error', reject, {once: true});
        });

        const cdp = new Cdp(socket);
        const {targetId} = await cdp.send('Target.createTarget', {url: 'about:blank'});
        const {sessionId} = await cdp.send('Target.attachToTarget', {targetId, flatten: true});
        const run = (expression) => cdp.send('Runtime.evaluate', {expression, awaitPromise: true}, sessionId);

        await cdp.send('Page.enable', {}, sessionId);
        await cdp.send('Emulation.setDeviceMetricsOverride',
            {width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false}, sessionId);

        const open = async (page) => {
            await cdp.send('Page.navigate', {url: `${BASE}/${page}`}, sessionId);
            await sleep(1600);
            const {exceptionDetails} = await run(OVERLAY);
            if (exceptionDetails) { throw new Error(`overlay failed: ${JSON.stringify(exceptionDetails)}`); }
        };

        await open('options.html');

        for (const step of steps) {
            if (step.page !== undefined) {
                await open(step.page);
            }
            if (step.js !== undefined) {
                const {exceptionDetails} = await run(step.js);
                if (exceptionDetails) { throw new Error(`step failed: ${JSON.stringify(exceptionDetails)}`); }
            }
            const count = Math.max(1, Math.round((step.hold / 1000) * FPS));
            for (let i = 0; i < count; i++) {
                const {data} = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
                writeFileSync(`${FRAMES}/f${String(frame++).padStart(5, '0')}.png`, Buffer.from(data, 'base64'));
            }
        }
    } finally {
        chrome.kill();
    }

    console.log(`captured ${frame} frames (${(frame / FPS).toFixed(1)}s), encoding…`);
    const ff = spawnSync('ffmpeg', [
        '-y', '-framerate', String(FPS), '-i', `${FRAMES}/f%05d.png`,
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
        '-movflags', '+faststart', OUT,
    ], {stdio: ['ignore', 'ignore', 'pipe']});

    if (ff.status !== 0) {
        throw new Error(`ffmpeg failed:\n${ff.stderr.toString().slice(-1500)}`);
    }
    console.log(`wrote ${OUT}`);
}

await main();
