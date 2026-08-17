import {compile} from '../core/compile';
import {loadConfig, saveReport, subscribeConfig} from '../core/storage';
import type {Config, SyncReport} from '../core/types';

const BADGE_ON = '#4d7cff';
const BADGE_OFF = '#5b6478';

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
                // treat a thrown validation error the same as "not supported"
            }
        }),
    );
    return supported;
}

async function updateBadge(config: Config): Promise<void> {
    const activeCount = config.profiles.filter((p) => p.enabled).length;
    const text = !config.enabled ? 'off' : activeCount > 0 ? String(activeCount) : '';

    await chrome.action.setBadgeText({text});
    await chrome.action.setBadgeBackgroundColor({color: config.enabled ? BADGE_ON : BADGE_OFF});
}

async function applyRules(rules: chrome.declarativeNetRequest.Rule[]): Promise<void> {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existing.map((rule) => rule.id),
        addRules: rules,
    });
}

async function sync(next?: Config): Promise<SyncReport> {
    const config = next ?? (await loadConfig());
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
    await updateBadge(config);
    return report;
}

chrome.runtime.onInstalled.addListener(() => void sync());
chrome.runtime.onStartup.addListener(() => void sync());
subscribeConfig((config) => void sync(config));

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
