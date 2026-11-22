/** Store screenshots at 1280x800 — `npm run shots`, with `npm run preview:ui` running. */
import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE ?? 'http://localhost:5173';
const OUT = 'docs/store-screenshots';
const WIDTH = 1280;
const HEIGHT = 800;
const PORT = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
    constructor(socket) {
        this.socket = socket;
        this.nextId = 0;
        this.pending = new Map();
        socket.addEventListener('message', (event) => {
            const msg = JSON.parse(event.data);
            const entry = this.pending.get(msg.id);
            if (entry === undefined) {
                return;
            }
            this.pending.delete(msg.id);
            if (msg.error) {
                entry.reject(new Error(JSON.stringify(msg.error)));
            } else {
                entry.resolve(msg.result);
            }
        });
    }

    send(method, params = {}, sessionId) {
        const id = ++this.nextId;
        const payload = {id, method, params};
        if (sessionId !== undefined) {
            payload.sessionId = sessionId;
        }
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
    mkdirSync(OUT, {recursive: true});

    const chrome = spawn(CHROME, [
        '--headless=new',
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${process.env.TMPDIR ?? '/tmp'}/hh-shots`,
        `--window-size=${WIDTH},${HEIGHT}`,
        '--hide-scrollbars',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
    ], {stdio: 'ignore'});

    try {
        const socket = new WebSocket(await waitForDevtools());
        await new Promise((resolve, reject) => {
            socket.addEventListener('open', resolve, {once: true});
            socket.addEventListener('error', reject, {once: true});
        });

        const cdp = new Cdp(socket);
        const {targetId} = await cdp.send('Target.createTarget', {url: 'about:blank'});
        const {sessionId} = await cdp.send('Target.attachToTarget', {targetId, flatten: true});

        await cdp.send('Page.enable', {}, sessionId);
        await cdp.send('Emulation.setDeviceMetricsOverride', {
            width: WIDTH,
            height: HEIGHT,
            deviceScaleFactor: 1, // the store rejects anything but exactly 1280x800
            mobile: false,
        }, sessionId);

        for (const shot of shots) {
            await cdp.send('Page.navigate', {url: `${BASE}/${shot.page}`}, sessionId);
            await sleep(1200);

            if (shot.setup !== undefined) {
                const {exceptionDetails} = await cdp.send('Runtime.evaluate', {
                    expression: shot.setup,
                    awaitPromise: true,
                }, sessionId);
                if (exceptionDetails !== undefined) {
                    throw new Error(`${shot.name}: ${JSON.stringify(exceptionDetails)}`);
                }
                await sleep(700);
            }

            const {data} = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
            const file = `${OUT}/${shot.name}.png`;
            writeFileSync(file, Buffer.from(data, 'base64'));
            console.log(`wrote ${file}`);
        }
    } finally {
        chrome.kill();
    }
}

const shots = [
    {
        name: '1-profiles',
        page: 'options.html',
        setup: `(async () => { window.scrollTo(0, 0); })()`,
    },
    {
        name: '2-editing',
        page: 'options.html',
        setup: `(async () => {
            document.querySelector('[data-profile="d4"] [data-action="expand"]').click();
            await new Promise(r => setTimeout(r, 250));
            const top = document.querySelector('[data-profile="c3"]');
            window.scrollTo(0, top.getBoundingClientRect().top + window.scrollY - 28);
        })()`,
    },
    {
        name: '3-diagnostics',
        page: 'options.html',
        setup: `(async () => {
            document.getElementById('test-url').value =
                'https://orders-proxy-dev.apps.example.com/api/v1/dispatch';
            document.getElementById('test-run').click();
            await new Promise(r => setTimeout(r, 450));
            const diag = document.querySelector('.diagnostics');
            window.scrollTo(0, diag.getBoundingClientRect().top + window.scrollY - 28);
        })()`,
    },
    {
        name: '4-popup',
        page: 'popup.html',
        setup: `(async () => {
            document.body.style.margin = '0 auto';
            document.body.style.border = '1px solid #454545';
            document.body.style.maxHeight = 'none';
            document.documentElement.style.padding = '48px 0';
            document.documentElement.style.background = '#1f1f1f';
            document.querySelector('[data-profile="d4"] [data-action="expand"]').click();
        })()`,
    },
];

await main();
