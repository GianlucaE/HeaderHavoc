import type {Config, Profile, SyncReport} from '../core/types';
import {profileCard} from './components';
import {duplicateProfile, matchesFilter, newHeader, newPattern, newProfile, Store} from './state';

export interface ProfileListOptions {
    conflicts?: (config: Config) => Map<string, string[]>;
}

export class ProfileList {
    private filter = '';
    private expanded = new Set<string>();
    private report: SyncReport | undefined;

    constructor(
        private readonly container: HTMLElement,
        private readonly store: Store,
        private readonly options: ProfileListOptions = {},
    ) {
        this.container.addEventListener('click', (event) => this.onClick(event));
        this.container.addEventListener('input', (event) => this.onInput(event));
        this.container.addEventListener('change', (event) => this.onChange(event));
        this.store.subscribe(() => this.render());
    }

    setFilter(filter: string): void {
        this.filter = filter;
        this.render();
    }

    setReport(report: SyncReport | undefined): void {
        this.report = report;
        this.render();
    }

    expand(profileId: string): void {
        this.expanded.add(profileId);
        this.render();
    }

    render(): void {
        const config: Config = this.store.get();
        const visible = config.profiles.filter((p) => matchesFilter(p, this.filter));

        this.container.replaceChildren();

        if (visible.length === 0) {
            const message =
                config.profiles.length === 0
                    ? 'No profiles yet. Add one to start rewriting headers.'
                    : 'No profiles match this filter.';
            this.container.append(Object.assign(document.createElement('p'), {
                className: 'empty',
                textContent: message
            }));
            return;
        }

        const conflicts = this.options.conflicts?.(config) ?? new Map<string, string[]>();

        for (const profile of visible) {
            this.container.append(
                profileCard(profile, {
                    expanded: this.expanded.has(profile.id),
                    errors: this.report?.errors.filter((e) => e.profileId === profile.id) ?? [],
                    conflicts: conflicts.get(profile.id) ?? [],
                }),
            );
        }
    }

    private context(event: Event): { profile: Profile; rowId: string | undefined } | undefined {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return undefined;
        }

        const profileId = target.closest('[data-profile]')?.getAttribute('data-profile');
        if (profileId === null || profileId === undefined) {
            return undefined;
        }

        const profile = this.store.profile(profileId);
        if (profile === undefined) {
            return undefined;
        }

        return {profile, rowId: target.closest('[data-row]')?.getAttribute('data-row') ?? undefined};
    }

    private onClick(event: Event): void {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const action = target.closest('[data-action]')?.getAttribute('data-action');
        if (action === null || action === undefined) {
            return;
        }

        const context = this.context(event);
        if (context === undefined) {
            return;
        }
        const {profile, rowId} = context;

        switch (action) {
            case 'toggle-profile':
                this.store.update(() => {
                    profile.enabled = !profile.enabled;
                });
                break;

            case 'expand':
                if (this.expanded.has(profile.id)) {
                    this.expanded.delete(profile.id);
                } else this.expanded.add(profile.id);
                this.render();
                break;

            case 'duplicate':
                this.store.update((config) => {
                    const index = config.profiles.indexOf(profile);
                    config.profiles.splice(index + 1, 0, duplicateProfile(profile));
                });
                break;

            case 'delete':
                if (!confirm(`Delete "${profile.name}"?`)) {
                    return;
                }
                this.store.update((config) => {
                    config.profiles = config.profiles.filter((p) => p.id !== profile.id);
                });
                break;

            case 'add-pattern':
                this.store.update(() => {
                    profile.urlPatterns.push(newPattern());
                });
                break;

            case 'remove-pattern':
                this.store.update(() => {
                    profile.urlPatterns = profile.urlPatterns.filter((p) => p.id !== rowId);
                });
                break;

            case 'cycle-mode':
                this.store.update(() => {
                    const pattern = profile.urlPatterns.find((p) => p.id === rowId);
                    if (pattern) {
                        pattern.mode = pattern.mode === 'glob' ? 'regex' : 'glob';
                    }
                });
                break;

            case 'add-header':
                this.store.update(() => {
                    profile.headers.push(newHeader());
                });
                break;

            case 'remove-header':
                this.store.update(() => {
                    profile.headers = profile.headers.filter((h) => h.id !== rowId);
                });
                break;

            case 'toggle-header':
                this.store.update(() => {
                    const header = profile.headers.find((h) => h.id === rowId);
                    if (header) {
                        header.enabled = !header.enabled;
                    }
                });
                break;

            default:
                break;
        }
    }

    private onInput(event: Event): void {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
            return;
        }

        const field = target.getAttribute('data-field');
        if (field === null) {
            return;
        }

        const context = this.context(event);
        if (context === undefined) {
            return;
        }
        const {profile, rowId} = context;
        const value = target.value;

        this.store.updateQuietly(() => {
            switch (field) {
                case 'name':
                    profile.name = value;
                    break;
                case 'pattern': {
                    const pattern = profile.urlPatterns.find((p) => p.id === rowId);
                    if (pattern) {
                        pattern.value = value;
                    }
                    break;
                }
                case 'header-name': {
                    const header = profile.headers.find((h) => h.id === rowId);
                    if (header) {
                        header.name = value;
                    }
                    break;
                }
                case 'header-value': {
                    const header = profile.headers.find((h) => h.id === rowId);
                    if (header) {
                        header.value = value;
                    }
                    break;
                }
                default:
                    break;
            }
        });
    }

    private onChange(event: Event): void {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement)) {
            return;
        }
        if (target.getAttribute('data-field') !== 'target') {
            return;
        }

        const context = this.context(event);
        if (context === undefined) {
            return;
        }

        const value = target.value === 'response' ? 'response' : 'request';
        this.store.updateQuietly(() => {
            const header = context.profile.headers.find((h) => h.id === context.rowId);
            if (header) {
                header.target = value;
            }
        });
    }
}

export function addProfile(store: Store, list: ProfileList): void {
    const profile = newProfile(store.get().profiles.length + 1);
    store.update((config) => {
        config.profiles.push(profile);
    });
    list.expand(profile.id);
}
