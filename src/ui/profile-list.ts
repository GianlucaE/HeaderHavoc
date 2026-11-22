import {activeHeaders, activePatterns} from '../core/compile';
import type {Config, HeaderMod, Profile, SyncReport, UrlPattern} from '../core/types';
import {profileCard, summaryLine} from './components';
import {duplicateProfile, matchesFilter, newHeader, newPattern, newProfile, Store} from './state';
import {showUndo} from './toast';

interface FocusSnapshot {
    profileId: string;
    rowId: string | undefined;
    field: string;
    start: number | null;
    end: number | null;
}

export interface ProfileListOptions {
    conflicts?: (config: Config) => Map<string, string[]>;
}

function usableShape(profile: Profile): string {
    return `${activePatterns(profile).length}/${activeHeaders(profile).length}`;
}

function findPattern(profile: Profile, rowId: string | undefined): UrlPattern | undefined {
    return profile.urlPatterns.find((p) => p.id === rowId);
}

function findHeader(profile: Profile, rowId: string | undefined): HeaderMod | undefined {
    return profile.headers.find((h) => h.id === rowId);
}

export class ProfileList {
    private filter = '';
    private expanded = new Set<string>();
    private report: SyncReport | undefined;
    private reportSignature = '';
    private focusNext: FocusSnapshot | undefined;

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
        const signature = JSON.stringify(report?.errors ?? []);
        const changed = signature !== this.reportSignature;

        this.report = report;
        this.reportSignature = signature;

        if (changed) {
            this.render();
        }
    }

    reveal(profileId: string): void {
        this.expanded.add(profileId);
        this.focusNext = {profileId, rowId: undefined, field: 'name', start: 0, end: Number.MAX_SAFE_INTEGER};
    }

    render(): void {
        const config: Config = this.store.get();
        const visible = config.profiles.filter((p) => matchesFilter(p, this.filter));
        const focus = this.focusNext ?? this.captureFocus();
        this.focusNext = undefined;

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
            this.restoreFocus(focus);
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

        this.restoreFocus(focus);
    }

    private captureFocus(): FocusSnapshot | undefined {
        const active = document.activeElement;
        if (!(active instanceof HTMLInputElement) || !this.container.contains(active)) {
            return undefined;
        }

        const field = active.getAttribute('data-field');
        const profileId = active.closest('[data-profile]')?.getAttribute('data-profile');
        if (field === null || profileId === null || profileId === undefined) {
            return undefined;
        }

        return {
            profileId,
            rowId: active.closest('[data-row]')?.getAttribute('data-row') ?? undefined,
            field,
            start: active.selectionStart,
            end: active.selectionEnd,
        };
    }

    private restoreFocus(snapshot: FocusSnapshot | undefined): void {
        if (snapshot === undefined) {
            return;
        }

        // Scope to the row when there is one, or `pattern` would find the first
        // pattern in the profile rather than the one being edited.
        const scopeSelector = snapshot.rowId === undefined
            ? `[data-profile="${CSS.escape(snapshot.profileId)}"]`
            : `[data-profile="${CSS.escape(snapshot.profileId)}"] [data-row="${CSS.escape(snapshot.rowId)}"]`;

        const scope = this.container.querySelector(scopeSelector);
        const field = scope?.querySelector(`[data-field="${CSS.escape(snapshot.field)}"]`);
        if (!(field instanceof HTMLInputElement)) {
            return;
        }

        field.focus();
        if (snapshot.start !== null) {
            field.setSelectionRange(snapshot.start, snapshot.end ?? snapshot.start);
        }
    }

    private reinsert(profileId: string, apply: (profile: Profile) => void): void {
        const profile = this.store.profile(profileId);
        if (profile === undefined) {
            return;
        }
        this.store.update(() => {
            apply(profile);
        });
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
                } else {
                    this.expanded.add(profile.id);
                }
                this.render();
                break;

            case 'duplicate':
                this.store.update((config) => {
                    const index = config.profiles.indexOf(profile);
                    config.profiles.splice(index + 1, 0, duplicateProfile(profile));
                });
                break;

            case 'delete': {
                const index = this.store.get().profiles.indexOf(profile);
                this.store.update((config) => {
                    config.profiles = config.profiles.filter((p) => p.id !== profile.id);
                });
                showUndo(`Deleted "${profile.name}"`, () => {
                    this.store.update((config) => {
                        config.profiles.splice(Math.min(index, config.profiles.length), 0, profile);
                    });
                });
                break;
            }

            case 'add-pattern': {
                const pattern = newPattern();
                this.focusNext = {profileId: profile.id, rowId: pattern.id, field: 'pattern', start: 0, end: 0};
                this.store.update(() => {
                    profile.urlPatterns.push(pattern);
                });
                break;
            }

            case 'remove-pattern': {
                const index = profile.urlPatterns.findIndex((p) => p.id === rowId);
                const removed = profile.urlPatterns[index];
                if (removed === undefined) {
                    break;
                }
                this.store.update(() => {
                    profile.urlPatterns.splice(index, 1);
                });
                showUndo('Removed URL pattern', () => {
                    this.reinsert(profile.id, (p) => p.urlPatterns.splice(Math.min(index, p.urlPatterns.length), 0, removed));
                });
                break;
            }

            case 'cycle-mode':
                this.store.update(() => {
                    const pattern = findPattern(profile, rowId);
                    if (pattern) {
                        pattern.mode = pattern.mode === 'glob' ? 'regex' : 'glob';
                    }
                });
                break;

            case 'add-header': {
                const header = newHeader();
                this.focusNext = {profileId: profile.id, rowId: header.id, field: 'header-name', start: 0, end: 0};
                this.store.update(() => {
                    profile.headers.push(header);
                });
                break;
            }

            case 'remove-header': {
                const index = profile.headers.findIndex((h) => h.id === rowId);
                const removed = profile.headers[index];
                if (removed === undefined) {
                    break;
                }
                this.store.update(() => {
                    profile.headers.splice(index, 1);
                });
                showUndo('Removed header', () => {
                    this.reinsert(profile.id, (p) => p.headers.splice(Math.min(index, p.headers.length), 0, removed));
                });
                break;
            }

            case 'toggle-header':
                this.store.update(() => {
                    const header = findHeader(profile, rowId);
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
        const shapeBefore = usableShape(profile);

        this.store.updateQuietly(() => {
            switch (field) {
                case 'name':
                    profile.name = value;
                    break;
                case 'pattern': {
                    const pattern = findPattern(profile, rowId);
                    if (pattern) {
                        pattern.value = value;
                    }
                    break;
                }
                case 'header-name': {
                    const header = findHeader(profile, rowId);
                    if (header) {
                        header.name = value;
                    }
                    break;
                }
                case 'header-value': {
                    const header = findHeader(profile, rowId);
                    if (header) {
                        header.value = value;
                    }
                    break;
                }
                default:
                    break;
            }
        });

        // re-render only when a field goes between empty and filled, so the caret never jumps
        if (usableShape(profile) !== shapeBefore) {
            this.store.notify();
            return;
        }

        const summary = this.container.querySelector(`[data-profile="${CSS.escape(profile.id)}"] .profile-summary`);
        summary?.replaceChildren(...summaryLine(profile));
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
            const header = findHeader(context.profile, context.rowId);
            if (header) {
                header.target = value;
            }
        });
    }
}

export function addProfile(store: Store, list: ProfileList): void {
    const profile = newProfile(store.get().profiles);
    list.reveal(profile.id);
    store.update((config) => {
        config.profiles.push(profile);
    });
}
