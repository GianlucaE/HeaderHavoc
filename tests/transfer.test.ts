import {describe, expect, test} from 'vitest';
import {exportFileName, fromStored, toStored} from '../src/core/transfer';
import type {StoredConfig} from '../src/core/types';
import workExport from './fixtures/work-export.json';

const canonical: StoredConfig = {
    enabled: true,
    theme: 'dark',
    profiles: [
        {
            id: '4ddf2576-0fc6-4f79-a77e-d0e525b34279',
            name: 'Staging',
            enabled: true,
            urlPatterns: [{value: 'api-gateway-*.example.com', mode: 'glob'}],
            headers: [{name: 'iv-user', value: 'jdoe', enabled: true, target: 'request'}],
        },
    ],
};

describe('fromStored', () => {
    test('preserves profile ids from the work-version export', () => {
        const config = fromStored(workExport);

        expect(config.profiles.map((p) => p.id)).toEqual([
            '4ddf2576-0fc6-4f79-a77e-d0e525b34279',
            '0452266c-a174-4f77-8432-3a5e649d70b5',
        ]);
    });

    test('generates a unique runtime id for every pattern and header row', () => {
        const config = fromStored(workExport);

        const ids = config.profiles.flatMap((p) => [
            ...p.urlPatterns.map((u) => u.id),
            ...p.headers.map((h) => h.id),
        ]);

        expect(ids).toHaveLength(6);
        expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
        expect(new Set(ids).size).toBe(6);
    });

    test('accepts the capitalised UrlPatterns key', () => {
        const config = fromStored(workExport);

        expect(config.profiles[0]?.urlPatterns).toHaveLength(2);
    });

    test('lowercases mode and target values', () => {
        const config = fromStored(workExport);

        expect(config.profiles[0]?.urlPatterns.map((u) => u.mode)).toEqual(['glob', 'regex']);
        expect(config.profiles[0]?.headers[0]?.target).toBe('request');
    });

    test('keeps duplicate header names within a profile', () => {
        const config = fromStored(workExport);

        expect(config.profiles[1]?.headers.map((h) => h.value)).toEqual(['api-2-value', 'api-2-value-2']);
    });

    test.each([
        ['null', null],
        ['undefined', undefined],
        ['an empty object', {}],
        ['a truncated file', '{"enabled": tr'],
        ['an array', []],
        ['profiles as a non-array', {enabled: true, profiles: 'nope'}],
    ])('returns a valid empty config for %s', (_label, input) => {
        const config = fromStored(input);

        expect(config.profiles).toEqual([]);
        expect(typeof config.enabled).toBe('boolean');
        expect(typeof config.theme).toBe('string');
    });

    test('defaults a profile to disabled when the field is missing', () => {
        const config = fromStored({profiles: [{id: 'x', name: 'y'}]});

        expect(config.profiles[0]?.enabled).toBe(false);
        expect(config.profiles[0]?.urlPatterns).toEqual([]);
        expect(config.profiles[0]?.headers).toEqual([]);
    });

    test('mints a profile id when the export lacks one', () => {
        const config = fromStored({profiles: [{name: 'no id'}]});

        expect(config.profiles[0]?.id).toBeTruthy();
    });

    test('drops unknown fields', () => {
        const config = fromStored({
            enabled: true,
            surprise: 'field',
            profiles: [{id: 'x', name: 'y', enabled: true, extra: 1, urlPatterns: [], headers: []}],
        });

        expect(config).not.toHaveProperty('surprise');
        expect(config.profiles[0]).not.toHaveProperty('extra');
    });

    test('falls back to glob for an unrecognised mode', () => {
        const config = fromStored({
            profiles: [{id: 'x', name: 'y', urlPatterns: [{value: 'a', mode: 'wat'}]}],
        });

        expect(config.profiles[0]?.urlPatterns[0]?.mode).toBe('glob');
    });
});

describe('toStored', () => {
    test('strips runtime row ids', () => {
        const stored = toStored(fromStored(canonical));

        expect(stored.profiles[0]?.urlPatterns[0]).not.toHaveProperty('id');
        expect(stored.profiles[0]?.headers[0]).not.toHaveProperty('id');
        expect(stored.profiles[0]?.id).toBe('4ddf2576-0fc6-4f79-a77e-d0e525b34279');
    });

    test('round-trips a well-formed config without losing data', () => {
        expect(toStored(fromStored(canonical))).toEqual(canonical);
    });

    test('preserves theme even though this build ignores it', () => {
        const stored = toStored(fromStored({...canonical, theme: 'light'}));

        expect(stored.theme).toBe('light');
    });
});

describe('exportFileName', () => {
    test('zero-pads month and day', () => {
        expect(exportFileName(new Date(2026, 7, 5))).toBe('header-havoc-2026-08-05.json');
    });

    test('uses the local date, not UTC', () => {
        // 2026-01-01 00:30 local is still 2025-12-31 in UTC for negative offsets.
        expect(exportFileName(new Date(2026, 0, 1, 0, 30))).toBe('header-havoc-2026-01-01.json');
    });
});
