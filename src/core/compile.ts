import type {Config, HeaderMod, Profile, RuleIndexEntry, SyncError, SyncReport, UrlPattern,} from './types';

export const ALL_RESOURCE_TYPES: `${chrome.declarativeNetRequest.ResourceType}`[] = [
    'main_frame',
    'sub_frame',
    'stylesheet',
    'script',
    'image',
    'font',
    'object',
    'xmlhttprequest',
    'ping',
    'csp_report',
    'media',
    'websocket',
    'webtransport',
    'webbundle',
    'other',
];

const PRIORITY = 1;

export interface CompileOptions {
    isRegexSupported?: (value: string) => boolean;
    now?: () => number;
}

export interface CompileResult {
    rules: chrome.declarativeNetRequest.Rule[];
    report: SyncReport;
}

function toModifyHeaderInfo(header: HeaderMod): chrome.declarativeNetRequest.ModifyHeaderInfo {
    return header.value === ''
        ? {header: header.name, operation: 'remove'}
        : {header: header.name, operation: 'set', value: header.value};
}

function buildAction(headers: HeaderMod[]): chrome.declarativeNetRequest.RuleAction {
    const requestHeaders = headers.filter((h) => h.target === 'request').map(toModifyHeaderInfo);
    const responseHeaders = headers.filter((h) => h.target === 'response').map(toModifyHeaderInfo);

    return {
        type: 'modifyHeaders',
        ...(requestHeaders.length > 0 ? {requestHeaders} : {}),
        ...(responseHeaders.length > 0 ? {responseHeaders} : {}),
    };
}

function buildCondition(pattern: UrlPattern): chrome.declarativeNetRequest.RuleCondition {
    const key = pattern.mode === 'regex' ? 'regexFilter' : 'urlFilter';
    return {[key]: pattern.value.trim(), resourceTypes: ALL_RESOURCE_TYPES};
}

export function compile(config: Config, options: CompileOptions = {}): CompileResult {
    const isRegexSupported = options.isRegexSupported ?? (() => true);
    const now = options.now ?? Date.now;

    const rules: chrome.declarativeNetRequest.Rule[] = [];
    const errors: SyncError[] = [];
    const index: RuleIndexEntry[] = [];
    let nextRuleId = 1;

    const fail = (profile: Profile, message: string, patternValue?: string): void => {
        errors.push({
            profileId: profile.id,
            profileName: profile.name,
            ...(patternValue === undefined ? {} : {patternValue}),
            message,
        });
    };

    if (config.enabled) {
        for (const profile of config.profiles) {
            if (!profile.enabled) {
                continue;
            }

            const headers = profile.headers.filter((h) => h.enabled && h.name.trim() !== '');
            if (headers.length === 0) {
                fail(profile, 'No enabled header rows, so this profile does nothing.');
                continue;
            }

            const patterns = profile.urlPatterns.filter((p) => p.value.trim() !== '');
            if (patterns.length === 0) {
                fail(profile, 'No URL patterns, so this profile matches nothing.');
                continue;
            }

            for (const pattern of patterns) {
                const value = pattern.value.trim();

                if (pattern.mode === 'regex' && !isRegexSupported(value)) {
                    fail(profile, 'Chrome rejected this regex (RE2 does not support it).', value);
                    continue;
                }

                const id = nextRuleId++;
                rules.push({
                    id,
                    priority: PRIORITY,
                    action: buildAction(headers),
                    condition: buildCondition(pattern),
                });
                index.push({
                    ruleId: id,
                    profileId: profile.id,
                    profileName: profile.name,
                    patternValue: value,
                    patternMode: pattern.mode,
                });
            }
        }
    }

    return {rules, report: {at: now(), ruleCount: rules.length, errors, index}};
}
