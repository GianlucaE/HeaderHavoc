import {loadConfig, saveConfig, subscribeConfig} from '../core/storage';
import {toStored} from '../core/transfer';
import type {Config, HeaderMod, Profile, UrlPattern} from '../core/types';

const SAVE_DEBOUNCE_MS = 300;

export type Listener = (config: Config) => void;

export class Store {
    private config: Config = {enabled: true, theme: 'dark', profiles: []};
    private lastWritten = '';
    private saveTimer: ReturnType<typeof setTimeout> | undefined;
    private listeners = new Set<Listener>();

    async init(): Promise<void> {
        this.config = await loadConfig();
        this.lastWritten = JSON.stringify(toStored(this.config));

        subscribeConfig((incoming) => {
            if (JSON.stringify(toStored(incoming)) === this.lastWritten) {
                return;
            }
            this.config = incoming;
            this.emit();
        });
    }

    get(): Config {
        return this.config;
    }

    subscribe(listener: Listener): void {
        this.listeners.add(listener);
    }

    update(mutate: (config: Config) => void): void {
        mutate(this.config);
        this.emit();
        this.scheduleSave();
    }

    updateQuietly(mutate: (config: Config) => void): void {
        mutate(this.config);
        this.scheduleSave();
    }

    profile(id: string): Profile | undefined {
        return this.config.profiles.find((p) => p.id === id);
    }

    private emit(): void {
        for (const listener of this.listeners) {
            listener(this.config);
        }
    }

    private scheduleSave(): void {
        if (this.saveTimer !== undefined) {
            clearTimeout(this.saveTimer);
        }
        this.saveTimer = setTimeout(() => {
            this.lastWritten = JSON.stringify(toStored(this.config));
            void saveConfig(this.config);
        }, SAVE_DEBOUNCE_MS);
    }
}

export function newProfile(index: number): Profile {
    return {
        id: crypto.randomUUID(),
        name: `Profile ${index}`,
        enabled: true,
        urlPatterns: [newPattern()],
        headers: [newHeader()],
    };
}

export function newPattern(): UrlPattern {
    return {id: crypto.randomUUID(), value: '', mode: 'glob'};
}

export function newHeader(): HeaderMod {
    return {id: crypto.randomUUID(), name: '', value: '', enabled: true, target: 'request'};
}

export function duplicateProfile(profile: Profile): Profile {
    return {
        id: crypto.randomUUID(),
        name: `${profile.name} copy`,
        enabled: profile.enabled,
        urlPatterns: profile.urlPatterns.map((p) => ({...p, id: crypto.randomUUID()})),
        headers: profile.headers.map((h) => ({...h, id: crypto.randomUUID()})),
    };
}

export function matchesFilter(profile: Profile, filter: string): boolean {
    const needle = filter.trim().toLowerCase();
    if (needle === '') {
        return true;
    }
    if (profile.name.toLowerCase().includes(needle)) {
        return true;
    }
    return profile.urlPatterns.some((p) => p.value.toLowerCase().includes(needle));
}

export function summarize(profile: Profile): string {
    const urls = profile.urlPatterns.length;
    const headers = profile.headers.filter((h) => h.enabled).length;
    return `${urls} ${urls === 1 ? 'URL' : 'URLs'} · ${headers} ${headers === 1 ? 'header' : 'headers'}`;
}
