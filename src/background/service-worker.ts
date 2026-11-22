import {compile, countLive} from '../core/compile';
import {coalesce} from '../core/serial';
import {loadConfig, saveReport, subscribeConfig} from '../core/storage';
import type {Config, SyncReport} from '../core/types';

const BADGE_ON = '#4d7cff';

const iconSet = (suffix: string): Record<number, string> => ({
    16: `icons/icon${suffix}-16.png`,
    32: `icons/icon${suffix}-32.png`,
    48: `icons/icon${suffix}-48.png`,
    128: `icons/icon${suffix}-128.png`,
});

const ICON_ON = iconSet('');
const ICON_OFF = iconSet('-off');

async function resolveSupportedRegexes(config: Config): Promise<Set<string>> {
    const candidates = new Set<string>();
    for (const profile of config.profiles) {
        for (const pattern of profile.urlPatterns) {
            const value = pattern.value.trim();
            if (pattern.mode === 'regex' && value !== '') {
                candidates.add(value);
            }
        }
    }

    const supported = new Set<string>();
    await Promise.all(
        [...candidates].map(async (regex) => {
            try {
                const result = await chrome.declarativeNetRequest.isRegexSupported({regex});
                if (result.isSupported) {
                    supported.add(regex);
                }
            } catch {
            }
        }),
    );
    return supported;
}

async function updateIcon(config: Config): Promise<void> {
    const activeCount = countLive(config);

    await chrome.action.setIcon({path: config.enabled ? ICON_ON : ICON_OFF});
    await chrome.action.setTitle({
        title: config.enabled ? `HeaderHavoc — ${activeCount} active` : 'HeaderHavoc — off',
    });

    if (!config.enabled || activeCount === 0) {
        await chrome.action.setBadgeText({text: ''});
        return;
    }

    await chrome.action.setBadgeText({text: String(activeCount)});
    await chrome.action.setBadgeBackgroundColor({color: BADGE_ON});
}

async function applyRules(rules: chrome.declarativeNetRequest.Rule[]): Promise<void> {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existing.map((rule) => rule.id),
        addRules: rules,
    });
}

async function syncNow(): Promise<SyncReport> {
    // read storage, not event data: with runs serialized, a passed-in snapshot could be stale
    const config = await loadConfig();
    const supported = await resolveSupportedRegexes(config);
    const {rules, report} = compile(config, {isRegexSupported: (v) => supported.has(v)});

    try {
        await applyRules(rules);
    } catch (error) {
        report.ruleCount = 0;
        report.errors.push({
            profileId: '',
            profileName: '',
            message: `Chrome rejected the rule set: ${error instanceof Error ? error.message : String(error)}`,
        });
    }

    await saveReport(report);
    await updateIcon(config);
    return report;
}

const sync = coalesce(syncNow);

chrome.runtime.onInstalled.addListener(() => void sync());
chrome.runtime.onStartup.addListener(() => void sync());
subscribeConfig(() => void sync());

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (typeof message !== 'object' || message === null) {
        return false;
    }
    if ((message as { type?: unknown }).type !== 'sync') {
        return false;
    }

    sync().then(sendResponse, (error: unknown) => sendResponse({error: String(error)}));
    return true;
});
