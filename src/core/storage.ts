import {fromStored, toStored} from './transfer';
import type {Config, SyncReport} from './types';

const CONFIG_KEY = 'config';
const REPORT_KEY = 'lastSync';

export async function loadConfig(): Promise<Config> {
    const raw = await chrome.storage.local.get(CONFIG_KEY);
    return fromStored(raw[CONFIG_KEY]);
}

export async function saveConfig(config: Config): Promise<void> {
    await chrome.storage.local.set({[CONFIG_KEY]: toStored(config)});
}

export function subscribeConfig(listener: (config: Config) => void): () => void {
    const handler = (
        changes: Record<string, chrome.storage.StorageChange>,
        area: string,
    ): void => {
        if (area !== 'local' || !(CONFIG_KEY in changes)) {
            return;
        }
        listener(fromStored(changes[CONFIG_KEY]?.newValue));
    };

    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
}

export async function loadReport(): Promise<SyncReport | undefined> {
    const raw = await chrome.storage.local.get(REPORT_KEY);
    const report = raw[REPORT_KEY];
    return report === undefined ? undefined : (report as SyncReport);
}

export function subscribeReport(listener: (report: SyncReport | undefined) => void): () => void {
    const handler = (
        changes: Record<string, chrome.storage.StorageChange>,
        area: string,
    ): void => {
        if (area !== 'local' || !(REPORT_KEY in changes)) {
            return;
        }
        listener(changes[REPORT_KEY]?.newValue as SyncReport | undefined);
    };

    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
}

export async function saveReport(report: SyncReport): Promise<void> {
    await chrome.storage.local.set({[REPORT_KEY]: report});
}
