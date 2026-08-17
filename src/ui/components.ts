import type {HeaderMod, Profile, SyncError, UrlPattern} from '../core/types';
import {summarize} from './state';

type Attrs = Record<string, string | boolean | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs: Attrs = {},
    children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (value === undefined || value === false) {
            continue;
        }
        node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children) {
        node.append(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
}

function toggle(checked: boolean, label: string, attrs: Attrs = {}): HTMLButtonElement {
    return el('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': String(checked),
        'aria-label': label,
        class: 'toggle',
        ...attrs,
    });
}

function iconButton(glyph: string, label: string, attrs: Attrs = {}): HTMLButtonElement {
    return el('button', {type: 'button', class: 'icon-btn', title: label, 'aria-label': label, ...attrs}, [
        glyph,
    ]);
}

function input(value: string, placeholder: string, attrs: Attrs = {}): HTMLInputElement {
    const node = el('input', {class: 'input input-mono', placeholder, ...attrs});
    node.value = value;
    return node;
}

function patternRow(pattern: UrlPattern, error?: SyncError): HTMLElement {
    const row = el('div', {class: 'pattern-row', 'data-row': pattern.id}, [
        el(
            'button',
            {
                type: 'button',
                class: 'chip',
                'data-mode': pattern.mode,
                'data-action': 'cycle-mode',
                title: 'Switch between glob and regex matching',
            },
            [pattern.mode],
        ),
        input(pattern.value, 'proxy.example.com', {
            'data-field': 'pattern',
            spellcheck: 'false',
            ...(error ? {class: 'input input-mono is-invalid'} : {}),
        }),
        iconButton('✕', 'Remove URL pattern', {'data-action': 'remove-pattern', class: 'icon-btn is-danger'}),
    ]);

    if (!error) {
        return row;
    }
    return el('div', {}, [row, el('div', {class: 'pattern-error'}, [error.message])]);
}

function headerRow(header: HeaderMod): HTMLElement {
    const select = el('select', {class: 'select select-target', 'data-field': 'target'}, [
        el('option', {value: 'request', selected: header.target === 'request'}, ['Request']),
        el('option', {value: 'response', selected: header.target === 'response'}, ['Response']),
    ]);

    return el('div', {class: 'header-row', 'data-row': header.id}, [
        toggle(header.enabled, `Enable header ${header.name || 'row'}`, {'data-action': 'toggle-header'}),
        input(header.name, 'iv-user', {'data-field': 'header-name', spellcheck: 'false'}),
        input(header.value, 'empty = remove', {'data-field': 'header-value', spellcheck: 'false'}),
        select,
        iconButton('✕', 'Remove header', {'data-action': 'remove-header', class: 'icon-btn is-danger'}),
    ]);
}

export interface ProfileCardOptions {
    expanded: boolean;
    errors?: SyncError[];
    conflicts?: string[];
}

export function profileCard(profile: Profile, options: ProfileCardOptions): HTMLElement {
    const {expanded, errors = [], conflicts = []} = options;

    const name = el('input', {class: 'profile-name', 'data-field': 'name', 'aria-label': 'Profile name'});
    name.value = profile.name;

    const card = el('section', {
        class: profile.enabled ? 'profile is-enabled' : 'profile',
        'data-profile': profile.id,
    });

    card.append(
        el('div', {class: 'profile-head'}, [
            toggle(profile.enabled, `Enable profile ${profile.name}`, {'data-action': 'toggle-profile'}),
            el(
                'button',
                {
                    type: 'button',
                    class: 'caret',
                    'data-action': 'expand',
                    'aria-expanded': String(expanded),
                    'aria-label': expanded ? 'Collapse profile' : 'Expand profile',
                },
                [expanded ? '▾' : '▸'],
            ),
            name,
            iconButton('⧉', 'Duplicate profile', {'data-action': 'duplicate'}),
            iconButton('✕', 'Delete profile', {'data-action': 'delete', class: 'icon-btn is-danger'}),
        ]),
    );

    const firstPattern = profile.urlPatterns[0]?.value ?? '';
    card.append(
        el('div', {class: 'profile-summary'}, [
            summarize(profile),
            ...(firstPattern === '' ? [] : [' — ', el('span', {class: 'pattern'}, [firstPattern])]),
        ]),
    );

    for (const message of conflicts) {
        card.append(el('div', {class: 'conflict'}, [message]));
    }

    if (!expanded) {
        return card;
    }

    const body = el('div', {class: 'profile-body'}, [
        el('div', {class: 'section-label'}, ['URL patterns']),
    ]);

    for (const pattern of profile.urlPatterns) {
        body.append(patternRow(pattern, errors.find((e) => e.patternValue === pattern.value.trim())));
    }
    body.append(el('button', {type: 'button', class: 'btn btn-dashed', 'data-action': 'add-pattern'}, ['+ Add URL']));

    body.append(el('div', {class: 'section-label'}, ['Headers']));
    for (const header of profile.headers) {
        body.append(headerRow(header));
    }
    body.append(el('button', {type: 'button', class: 'btn btn-dashed', 'data-action': 'add-header'}, ['+ Add header']));

    card.append(body);
    return card;
}
