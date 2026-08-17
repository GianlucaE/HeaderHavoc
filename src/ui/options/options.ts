import {findConflicts} from '../../core/conflicts';
import {evaluatePatterns} from '../../core/match';
import {loadReport} from '../../core/storage';
import {exportFileName, fromStored, toStored} from '../../core/transfer';
import type {Config, SyncReport} from '../../core/types';
import {addProfile, ProfileList} from '../profile-list';
import {Store} from '../state';
import './options.css';

function must<T extends HTMLElement>(id: string): T {
    const node = document.getElementById(id);
    if (node === null) {
        throw new Error(`Missing element #${id}`);
    }
    return node as T;
}

const els = {
    pulse: must('pulse'),
    status: must('status'),
    globalToggle: must<HTMLButtonElement>('global-toggle'),
    filter: must<HTMLInputElement>('filter'),
    profiles: must('profiles'),
    addProfile: must<HTMLButtonElement>('add-profile'),
    export: must<HTMLButtonElement>('export'),
    import: must<HTMLButtonElement>('import'),
    importFile: must<HTMLInputElement>('import-file'),
    syncLine: must('sync-line'),
    showRules: must<HTMLButtonElement>('show-rules'),
    showMatches: must<HTMLButtonElement>('show-matches'),
    refresh: must<HTMLButtonElement>('refresh'),
    testUrl: must<HTMLInputElement>('test-url'),
    testType: must<HTMLSelectElement>('test-type'),
    testRun: must<HTMLButtonElement>('test-run'),
    output: must<HTMLPreElement>('output'),
};

const store = new Store();
let report: SyncReport | undefined;

const list = new ProfileList(els.profiles, store, {conflicts: findConflicts});

/* ---------- output panel ---------- */

type Tone = 'ok' | 'no' | 'bad' | 'key' | 'plain';

function line(text: string, tone: Tone = 'plain'): HTMLElement {
    const span = document.createElement('span');
    if (tone !== 'plain') {
        span.className = tone;
    }
    span.textContent = `${text}\n`;
    return span;
}

function show(parts: (HTMLElement | string)[]): void {
    els.output.hidden = false;
    els.output.replaceChildren();
    for (const part of parts) {
        els.output.append(typeof part === 'string' ? line(part) : part);
    }
}

function showError(error: unknown): void {
    show([line(error instanceof Error ? error.message : String(error), 'bad')]);
}

/* ---------- header chrome ---------- */

function renderChrome(config: Config): void {
    const active = config.profiles.filter((p) => p.enabled).length;
    const total = config.profiles.length;

    els.globalToggle.setAttribute('aria-checked', String(config.enabled));
    els.pulse.classList.toggle('is-live', config.enabled && active > 0);
    els.status.textContent = config.enabled
        ? `${active} active · ${total} ${total === 1 ? 'profile' : 'profiles'}`
        : 'Disabled — no headers are being rewritten';
}

function renderSyncLine(): void {
    if (report === undefined) {
        els.syncLine.textContent = 'No sync recorded yet.';
        return;
    }

    const when = new Date(report.at).toLocaleString();
    const count = `${report.ruleCount} rule${report.ruleCount === 1 ? '' : 's'} active`;
    const errors = report.errors.length;

    els.syncLine.classList.toggle('has-errors', errors > 0);
    els.syncLine.textContent =
        errors === 0
            ? `Last sync: ${when} — ${count}`
            : `Last sync: ${when} — ${count}, ${errors} problem${errors === 1 ? '' : 's'}: ${report.errors
                .map((e) => (e.profileName === '' ? e.message : `${e.profileName}: ${e.message}`))
                .join(' | ')}`;
}

async function refreshReport(): Promise<void> {
    report = await loadReport();
    renderSyncLine();
    list.setReport(report);
}

/* ---------- diagnostics ---------- */

function describeHeaders(config: Config, profileId: string): HTMLElement[] {
    const profile = config.profiles.find((p) => p.id === profileId);
    if (profile === undefined) {
        return [];
    }

    return profile.headers
        .filter((h) => h.enabled && h.name.trim() !== '')
        .map((h) =>
            line(
                h.value === ''
                    ? `        ${h.target}: remove ${h.name}`
                    : `        ${h.target}: set ${h.name}: ${h.value}`,
                'key',
            ),
        );
}

async function runTest(): Promise<void> {
    const url = els.testUrl.value.trim();
    if (url === '') {
        show([line('Enter a URL to test.', 'no')]);
        return;
    }

    const type = els.testType.value as `${chrome.declarativeNetRequest.ResourceType}`;
    const config = store.get();
    const parts: (HTMLElement | string)[] = [];

    try {
        const outcome = await chrome.declarativeNetRequest.testMatchOutcome({url, type, method: 'get'});
        const matched = outcome.matchedRules;
        const label = els.testType.selectedOptions[0]?.textContent ?? type;

        parts.push(
            line(
                `Chrome matched ${matched.length} rule${matched.length === 1 ? '' : 's'} for a "${label}" request.`,
                matched.length > 0 ? 'ok' : 'no',
            ),
        );

        for (const rule of matched) {
            const entry = report?.index.find((i) => i.ruleId === rule.ruleId);
            if (entry === undefined) {
                parts.push(line(`    rule ${rule.ruleId} (run Refresh to map it back to a profile)`, 'no'));
                continue;
            }
            parts.push(line(`    ${entry.profileName} — [${entry.patternMode}] ${entry.patternValue}  (rule ${entry.ruleId})`, 'ok'));
            parts.push(...describeHeaders(config, entry.profileId));
        }
    } catch (error) {
        parts.push(line(`Chrome could not test that URL: ${error instanceof Error ? error.message : String(error)}`, 'bad'));
    }

    const verdicts = evaluatePatterns(config, url);
    parts.push(line(''));
    parts.push(line('Your patterns:'));

    if (verdicts.length === 0) {
        parts.push(line('    no patterns defined', 'no'));
    }

    for (const verdict of verdicts) {
        const mark = verdict.matched ? '✓' : '✗';
        const note = verdict.profileEnabled ? '' : '  (profile disabled)';
        parts.push(
            line(
                `    ${mark} ${verdict.profileName} — [${verdict.patternMode}] ${verdict.patternValue}${note}`,
                verdict.matched ? 'ok' : 'no',
            ),
        );
    }

    if (verdicts.some((v) => v.patternMode === 'regex')) {
        parts.push(line(''));
        parts.push(
            line(
                'Note: regex patterns are checked here with the JavaScript engine, which is close to but not identical to the RE2 engine Chrome uses. Chrome\'s verdict above is authoritative.',
                'no',
            ),
        );
    }

    show(parts);
}

/* ---------- export / import ---------- */

function exportConfig(): void {
    const json = JSON.stringify(toStored(store.get()), null, 2);
    const url = URL.createObjectURL(new Blob([json], {type: 'application/json'}));
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = exportFileName();
    anchor.click();
    URL.revokeObjectURL(url);
}

async function importConfig(file: File): Promise<void> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(await file.text());
    } catch {
        show([line(`${file.name} is not valid JSON.`, 'bad')]);
        return;
    }

    const incoming = fromStored(parsed);
    const count = incoming.profiles.length;
    const confirmed = confirm(
        `Import ${count} profile${count === 1 ? '' : 's'} from ${file.name}?\n\nThis replaces your current profiles.`,
    );
    if (!confirmed) {
        return;
    }

    store.update((config) => {
        config.enabled = incoming.enabled;
        config.theme = incoming.theme;
        config.profiles = incoming.profiles;
    });
    show([line(`Imported ${count} profile${count === 1 ? '' : 's'} from ${file.name}.`, 'ok')]);
}

/* ---------- wiring ---------- */

els.globalToggle.addEventListener('click', () => {
    store.update((config) => {
        config.enabled = !config.enabled;
    });
});

els.filter.addEventListener('input', () => list.setFilter(els.filter.value));
els.addProfile.addEventListener('click', () => addProfile(store, list));
els.export.addEventListener('click', exportConfig);
els.import.addEventListener('click', () => els.importFile.click());

els.importFile.addEventListener('change', () => {
    const file = els.importFile.files?.[0];
    els.importFile.value = '';
    if (file !== undefined) {
        void importConfig(file);
    }
});

els.showRules.addEventListener('click', () => {
    chrome.declarativeNetRequest
        .getDynamicRules()
        .then((rules) =>
            show([
                line(`${rules.length} rule${rules.length === 1 ? '' : 's'} registered with Chrome.`),
                line(''),
                line(JSON.stringify(rules, null, 2)),
            ]),
        )
        .catch(showError);
});

els.showMatches.addEventListener('click', () => {
    chrome.declarativeNetRequest
        .getMatchedRules({})
        .then((matched) => {
            const infos = matched.rulesMatchedInfo;
            if (infos.length === 0) {
                show([line('No rule matches recorded in this session yet.', 'no')]);
                return;
            }
            show([
                line(`${infos.length} recent match${infos.length === 1 ? '' : 'es'}:`),
                ...infos.map((info) => {
                    const entry = report?.index.find((i) => i.ruleId === info.rule.ruleId);
                    const when = new Date(info.timeStamp).toLocaleTimeString();
                    const who = entry === undefined ? `rule ${info.rule.ruleId}` : `${entry.profileName} — ${entry.patternValue}`;
                    return line(`    ${when}  tab ${info.tabId}  ${who}`, 'ok');
                }),
            ]);
        })
        .catch(showError);
});

els.refresh.addEventListener('click', () => {
    chrome.runtime
        .sendMessage({type: 'sync'})
        .then(() => refreshReport())
        .then(() => show([line('Rules recompiled.', 'ok')]))
        .catch(showError);
});

els.testRun.addEventListener('click', () => void runTest());
els.testUrl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        void runTest();
    }
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && 'lastSync' in changes) {
        void refreshReport();
    }
});

store.subscribe(renderChrome);

async function main(): Promise<void> {
    await store.init();
    renderChrome(store.get());
    list.render();
    await refreshReport();
}

void main();
