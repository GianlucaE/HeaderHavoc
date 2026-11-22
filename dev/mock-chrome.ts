import {compile} from '../src/core/compile';
import {matchesPattern} from '../src/core/match';
import {fromStored} from '../src/core/transfer';
import type {StoredConfig} from '../src/core/types';

const seed: StoredConfig = {
    enabled: true,
    theme: 'dark',
    profiles: [
        {
            id: 'a1',
            name: 'Team lead',
            enabled: false,
            urlPatterns: [
                {value: 'api-gateway-*.apps.example.com', mode: 'glob'},
                {value: 'portal.apps.example.com', mode: 'glob'},
            ],
            headers: [{name: 'iv-user', value: 'alead', enabled: true, target: 'request'}],
        },
        {
            id: 'b2',
            name: 'Read only',
            enabled: false,
            urlPatterns: [{value: 'api-gateway-*.apps.example.com', mode: 'glob'}],
            headers: [{name: 'iv-user', value: 'breader', enabled: true, target: 'request'}],
        },
        {
            id: 'c3',
            name: 'Admin',
            enabled: false,
            urlPatterns: [{value: '^https://api-gateway-\\d+\\.apps\\.example\\.com/.*', mode: 'regex'}],
            headers: [{name: 'iv-user', value: 'cadmin', enabled: true, target: 'request'}],
        },
        {
            id: 'd4',
            name: 'Dispatch dev',
            enabled: true,
            urlPatterns: [
                {value: 'forms-proxy-dev.apps.example.com', mode: 'glob'},
                {value: 'orders-proxy-dev.apps.example.com', mode: 'glob'},
            ],
            headers: [{name: 'iv-user', value: 'jdoe', enabled: true, target: 'request'}],
        },
    ],
};

type ChangeListener = (changes: Record<string, { newValue?: unknown }>, area: string) => void;

const cell: Record<string, unknown> = {config: seed};
const changeListeners: ChangeListener[] = [];
let dynamicRules: chrome.declarativeNetRequest.Rule[] = [];

function resync(): void {
    const {rules, report} = compile(fromStored(cell['config']));
    dynamicRules = rules;
    cell['lastSync'] = report;
    for (const listener of changeListeners) {
        listener({lastSync: {newValue: report}}, 'local');
    }
}

const mock = {
    storage: {
        local: {
            get: async (key: string) => ({[key]: cell[key]}),
            set: async (items: Record<string, unknown>) => {
                const changes: Record<string, { newValue?: unknown }> = {};
                for (const [key, value] of Object.entries(items)) {
                    cell[key] = value;
                    changes[key] = {newValue: value};
                }
                for (const listener of changeListeners) {
                    listener(changes, 'local');
                }
                if ('config' in items) {
                    resync();
                }
            },
        },
        onChanged: {
            addListener: (fn: ChangeListener) => changeListeners.push(fn),
            removeListener: (fn: ChangeListener) => {
                const index = changeListeners.indexOf(fn);
                if (index >= 0) {
                    changeListeners.splice(index, 1);
                }
            },
        },
    },
    declarativeNetRequest: {
        getDynamicRules: async () => dynamicRules,
        updateDynamicRules: async () => undefined,
        isRegexSupported: async ({regex}: { regex: string }) => {
            try {
                new RegExp(regex);
                return {isSupported: true};
            } catch {
                return {isSupported: false, reason: 'syntaxError'};
            }
        },
        testMatchOutcome: async ({url}: { url: string }) => {
            const config = fromStored(cell['config']);
            const {report} = compile(config);
            const matchedRules = report.index
                .filter((entry) => matchesPattern({value: entry.patternValue, mode: entry.patternMode}, url))
                .map((entry) => ({ruleId: entry.ruleId, rulesetId: '_dynamic'}));
            return {matchedRules};
        },
        getMatchedRules: async () => ({
            rulesMatchedInfo: dynamicRules.slice(0, 2).map((rule) => ({
                rule: {ruleId: rule.id, rulesetId: '_dynamic'},
                tabId: 42,
                timeStamp: Date.now(),
            })),
        }),
    },
    runtime: {
        sendMessage: async () => {
            resync();
            return cell['lastSync'];
        },
        openOptionsPage: () => window.open('/options.html', '_blank'),
        onMessage: {addListener: () => undefined},
        onInstalled: {addListener: () => undefined},
        onStartup: {addListener: () => undefined},
    },
    action: {
        setBadgeText: async () => undefined,
        setBadgeBackgroundColor: async () => undefined,
    },
};

(globalThis as unknown as { chrome: unknown }).chrome = mock;
resync();
