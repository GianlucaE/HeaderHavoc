import {findConflicts} from '../../core/conflicts';
import {loadReport} from '../../core/storage';
import type {Config} from '../../core/types';
import {addProfile, ProfileList} from '../profile-list';
import {Store} from '../state';
import './popup.css';

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
    syncHint: must('sync-hint'),
    openOptions: must<HTMLButtonElement>('open-options'),
};

const store = new Store();
const list = new ProfileList(els.profiles, store, {conflicts: findConflicts});

function renderChrome(config: Config): void {
    const active = config.profiles.filter((p) => p.enabled).length;
    const total = config.profiles.length;

    els.globalToggle.setAttribute('aria-checked', String(config.enabled));
    els.pulse.classList.toggle('is-live', config.enabled && active > 0);
    els.status.textContent = config.enabled
        ? `${active} active · ${total} ${total === 1 ? 'profile' : 'profiles'}`
        : 'Disabled — no headers are being rewritten';
}

els.globalToggle.addEventListener('click', () => {
    store.update((config) => {
        config.enabled = !config.enabled;
    });
});

els.filter.addEventListener('input', () => list.setFilter(els.filter.value));
els.addProfile.addEventListener('click', () => addProfile(store, list));
els.openOptions.addEventListener('click', () => chrome.runtime.openOptionsPage());

async function main(): Promise<void> {
    await store.init();
    renderChrome(store.get());
    list.render();

    const report = await loadReport();
    list.setReport(report);
    if (report !== undefined) {
        els.syncHint.textContent = `${report.ruleCount} rule${report.ruleCount === 1 ? '' : 's'} active`;
    }
}

store.subscribe(renderChrome);
void main();
