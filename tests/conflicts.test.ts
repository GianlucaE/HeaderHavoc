import {describe, expect, test} from 'vitest';
import {findConflicts} from '../src/core/conflicts';
import {fromStored} from '../src/core/transfer';
import type {Config, StoredHeader, StoredProfile} from '../src/core/types';

const header = (over: Partial<StoredHeader> = {}): StoredHeader => ({
    name: 'iv-user',
    value: 'jdoe',
    enabled: true,
    target: 'request',
    ...over,
});

const profile = (over: Partial<StoredProfile> = {}): StoredProfile => ({
    id: 'p1',
    name: 'Profile 1',
    enabled: true,
    urlPatterns: [{value: 'example.com', mode: 'glob'}],
    headers: [header()],
    ...over,
});

const config = (profiles: StoredProfile[], enabled = true): Config =>
    fromStored({enabled, theme: 'dark', profiles});

describe('findConflicts', () => {
    test('flags two enabled profiles setting the same header on the same pattern', () => {
        const conflicts = findConflicts(
            config([profile({id: 'a', name: 'Staging'}), profile({id: 'b', name: 'Admin'})]),
        );

        expect(conflicts.get('a')?.[0]).toContain('Admin');
        expect(conflicts.get('b')?.[0]).toContain('Staging');
    });

    test('names the header that collides', () => {
        const conflicts = findConflicts(
            config([profile({id: 'a', name: 'Staging'}), profile({id: 'b', name: 'Admin'})]),
        );

        expect(conflicts.get('a')?.[0]).toContain('iv-user');
    });

    test('ignores profiles whose patterns do not overlap', () => {
        const conflicts = findConflicts(
            config([
                profile({id: 'a', urlPatterns: [{value: 'one.example.com', mode: 'glob'}]}),
                profile({id: 'b', urlPatterns: [{value: 'two.example.com', mode: 'glob'}]}),
            ]),
        );

        expect(conflicts.size).toBe(0);
    });

    test('ignores a disabled profile', () => {
        const conflicts = findConflicts(
            config([profile({id: 'a'}), profile({id: 'b', enabled: false})]),
        );

        expect(conflicts.size).toBe(0);
    });

    test('ignores a disabled header row', () => {
        const conflicts = findConflicts(
            config([profile({id: 'a'}), profile({id: 'b', headers: [header({enabled: false})]})]),
        );

        expect(conflicts.size).toBe(0);
    });

    test('does not flag the same name twice inside one profile', () => {
        const conflicts = findConflicts(
            config([profile({headers: [header(), header({value: 'other', enabled: false})]})]),
        );

        expect(conflicts.size).toBe(0);
    });

    test('treats header names case-insensitively, as HTTP does', () => {
        const conflicts = findConflicts(
            config([profile({id: 'a'}), profile({id: 'b', headers: [header({name: 'IV-User'})]})]),
        );

        expect(conflicts.size).toBe(2);
    });

    test('does not flag a request header against a response header', () => {
        const conflicts = findConflicts(
            config([profile({id: 'a'}), profile({id: 'b', headers: [header({target: 'response'})]})]),
        );

        expect(conflicts.size).toBe(0);
    });

    test('reports nothing when the global switch is off', () => {
        const conflicts = findConflicts(config([profile({id: 'a'}), profile({id: 'b'})], false));

        expect(conflicts.size).toBe(0);
    });
});
