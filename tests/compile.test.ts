import {describe, expect, test} from 'vitest';
import {ALL_RESOURCE_TYPES, compile} from '../src/core/compile';
import {fromStored} from '../src/core/transfer';
import type {Config, StoredConfig, StoredProfile} from '../src/core/types';

function profile(overrides: Partial<StoredProfile> = {}): StoredProfile {
    return {
        id: 'p1',
        name: 'Profile 1',
        enabled: true,
        urlPatterns: [{value: 'example.com', mode: 'glob'}],
        headers: [{name: 'iv-user', value: 'jdoe', enabled: true, target: 'request'}],
        ...overrides,
    };
}

function config(profiles: StoredProfile[], enabled = true): Config {
    const stored: StoredConfig = {enabled, theme: 'dark', profiles};
    return fromStored(stored);
}

describe('compile', () => {
    test('emits one rule per pattern of an enabled profile', () => {
        const {rules} = compile(
            config([
                profile({
                    urlPatterns: [
                        {value: 'proxy-dev.example.com', mode: 'glob'},
                        {value: 'test.example.us', mode: 'glob'},
                    ],
                }),
            ]),
        );

        expect(rules).toHaveLength(2);
    });

    test('gives every rule a unique positive id', () => {
        const {rules} = compile(
            config([
                profile({id: 'a', urlPatterns: [{value: 'a.com', mode: 'glob'}]}),
                profile({id: 'b', urlPatterns: [{value: 'b.com', mode: 'glob'}]}),
            ]),
        );

        const ids = rules.map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.every((id) => Number.isInteger(id) && id > 0)).toBe(true);
    });

    test('matches every resource type, including main_frame', () => {
        const {rules} = compile(config([profile()]));

        expect(rules[0]?.condition.resourceTypes).toEqual(ALL_RESOURCE_TYPES);
        expect(rules[0]?.condition.resourceTypes).toContain('main_frame');
    });

    test('uses urlFilter for glob patterns and regexFilter for regex patterns', () => {
        const {rules} = compile(
            config([
                profile({
                    urlPatterns: [
                        {value: 'example.com', mode: 'glob'},
                        {value: '^https://api\\.example\\.com/.*', mode: 'regex'},
                    ],
                }),
            ]),
        );

        expect(rules[0]?.condition.urlFilter).toBe('example.com');
        expect(rules[0]?.condition.regexFilter).toBeUndefined();
        expect(rules[1]?.condition.regexFilter).toBe('^https://api\\.example\\.com/.*');
        expect(rules[1]?.condition.urlFilter).toBeUndefined();
    });

    test('sets a header that has a value', () => {
        const {rules} = compile(config([profile()]));

        expect(rules[0]?.action.requestHeaders).toEqual([
            {header: 'iv-user', operation: 'set', value: 'jdoe'},
        ]);
    });

    test('removes a header whose value is empty', () => {
        const {rules} = compile(
            config([
                profile({headers: [{name: 'iv-user', value: '', enabled: true, target: 'request'}]}),
            ]),
        );

        expect(rules[0]?.action.requestHeaders).toEqual([{header: 'iv-user', operation: 'remove'}]);
    });

    test('routes response headers to responseHeaders', () => {
        const {rules} = compile(
            config([
                profile({
                    headers: [
                        {name: 'x-req', value: '1', enabled: true, target: 'request'},
                        {name: 'x-res', value: '2', enabled: true, target: 'response'},
                    ],
                }),
            ]),
        );

        expect(rules[0]?.action.requestHeaders).toHaveLength(1);
        expect(rules[0]?.action.responseHeaders).toEqual([
            {header: 'x-res', operation: 'set', value: '2'},
        ]);
    });

    test('omits an empty header array rather than sending one', () => {
        const {rules} = compile(config([profile()]));

        expect(rules[0]?.action.responseHeaders).toBeUndefined();
    });

    test('skips a disabled profile', () => {
        const {rules} = compile(config([profile({enabled: false})]));

        expect(rules).toEqual([]);
    });

    test('skips a disabled header row', () => {
        const {rules} = compile(
            config([
                profile({
                    headers: [
                        {name: 'on', value: '1', enabled: true, target: 'request'},
                        {name: 'off', value: '2', enabled: false, target: 'request'},
                    ],
                }),
            ]),
        );

        expect(rules[0]?.action.requestHeaders).toEqual([
            {header: 'on', operation: 'set', value: '1'},
        ]);
    });

    test('emits nothing when the global switch is off', () => {
        const {rules} = compile(config([profile()], false));

        expect(rules).toEqual([]);
    });

    test('skips a profile with no patterns', () => {
        const {rules, report} = compile(config([profile({urlPatterns: []})]));

        expect(rules).toEqual([]);
        expect(report.errors[0]?.message).toMatch(/pattern/i);
    });

    test('skips a profile whose headers are all disabled', () => {
        const {rules, report} = compile(
            config([
                profile({headers: [{name: 'x', value: '1', enabled: false, target: 'request'}]}),
            ]),
        );

        expect(rules).toEqual([]);
        expect(report.errors[0]?.message).toMatch(/header/i);
    });

    test('skips a pattern with an empty value', () => {
        const {rules} = compile(config([profile({urlPatterns: [{value: '  ', mode: 'glob'}]})]));

        expect(rules).toEqual([]);
    });

    test('gives all rules equal priority', () => {
        const {rules} = compile(
            config([
                profile({id: 'a', urlPatterns: [{value: 'a.com', mode: 'glob'}]}),
                profile({id: 'b', urlPatterns: [{value: 'b.com', mode: 'glob'}]}),
            ]),
        );

        expect(new Set(rules.map((r) => r.priority))).toEqual(new Set([1]));
    });

    test('indexes each rule id back to its profile and pattern', () => {
        const {rules, report} = compile(
            config([profile({name: 'Staging', urlPatterns: [{value: 'staging.example.com', mode: 'glob'}]})]),
        );

        expect(report.index).toEqual([
            {
                ruleId: rules[0]?.id,
                profileId: 'p1',
                profileName: 'Staging',
                patternValue: 'staging.example.com',
                patternMode: 'glob',
            },
        ]);
    });

    test('reports the rule count', () => {
        const {report} = compile(config([profile()]));

        expect(report.ruleCount).toBe(1);
    });

    test('drops an unsupported regex without losing the other rules', () => {
        const {rules, report} = compile(
            config([
                profile({
                    urlPatterns: [
                        {value: 'good.example.com', mode: 'glob'},
                        {value: '(?<=lookbehind)', mode: 'regex'},
                    ],
                }),
            ]),
            {isRegexSupported: (value) => value !== '(?<=lookbehind)'},
        );

        expect(rules).toHaveLength(1);
        expect(rules[0]?.condition.urlFilter).toBe('good.example.com');
        expect(report.errors).toHaveLength(1);
        expect(report.errors[0]?.patternValue).toBe('(?<=lookbehind)');
    });
});
