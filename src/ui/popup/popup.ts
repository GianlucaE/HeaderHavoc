import {findConflicts} from '../../core/conflicts';
import {loadReport, subscribeReport} from '../../core/storage';
import type {SyncReport} from '../../core/types';
import {addProfile, ProfileList} from '../profile-list';
import {must, renderShell} from '../shell';
import {Store} from '../state';
import './popup.css';

const els = {
    globalToggle: must<HTMLButtonElement>('global-toggle'),
    filter: must<HTMLInputElement>('filter'),
    profiles: must('profiles'),
    addProfile: must<HTMLButtonElement>('add-profile'),
    openOptions: must<HTMLButtonElement>('open-options'),
};

const store = new Store();
const list = new ProfileList(els.profiles, store, {conflicts: findConflicts});

els.globalToggle.addEventListener('click', () => {
    store.update((config) => {
        config.enabled = !config.enabled;
    });
});

els.filter.addEventListener('input', () => list.setFilter(els.filter.value));
els.addProfile.addEventListener('click', () => addProfile(store, list));
els.openOptions.addEventListener('click', () => chrome.runtime.openOptionsPage());

function renderReport(report: SyncReport | undefined): void {
    list.setReport(report);
}

async function main(): Promise<void> {
    await store.init();
    renderShell(store.get());
    list.render();
    renderReport(await loadReport());
}

store.subscribe(renderShell);
subscribeReport(renderReport);
void main();
