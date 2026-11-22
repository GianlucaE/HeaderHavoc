import {describe, expect, test} from 'vitest';
import {fromStored} from '../src/core/transfer';
import type {Profile, StoredProfile} from '../src/core/types';
import {duplicateProfile, newProfile} from '../src/ui/state';

function profiles(names: string[]): Profile[] {
    return fromStored({profiles: names.map((name, i): Partial<StoredProfile> => ({id: `p${i}`, name}))}).profiles;
}

describe('newProfile', () => {
    test('starts numbering at 1', () => {
        expect(newProfile([]).name).toBe('Profile 1');
    });

    test('fills the lowest free number after a delete', () => {
        expect(newProfile(profiles(['Profile 1', 'Profile 3'])).name).toBe('Profile 2');
    });

    test('never reuses a taken name', () => {
        expect(newProfile(profiles(['Profile 1', 'Profile 2'])).name).toBe('Profile 3');
    });

    test('ignores profiles the user renamed', () => {
        expect(newProfile(profiles(['Staging', 'Admin'])).name).toBe('Profile 1');
    });
});

describe('duplicateProfile', () => {
    const [source] = fromStored({
        profiles: [{
            id: 'src',
            name: 'Staging',
            enabled: true,
            urlPatterns: [{value: 'example.com', mode: 'glob'}],
            headers: [{name: 'iv-user', value: 'jdoe', enabled: true, target: 'request'}],
        }],
    }).profiles as [Profile];

    test('starts disabled, so it cannot conflict with the original', () => {
        expect(duplicateProfile(source).enabled).toBe(false);
    });

    test('names the copy after the original', () => {
        expect(duplicateProfile(source).name).toBe('Staging copy');
    });

    test('gives the profile and every row fresh ids', () => {
        const copy = duplicateProfile(source);

        expect(copy.id).not.toBe(source.id);
        expect(copy.urlPatterns[0]?.id).not.toBe(source.urlPatterns[0]?.id);
        expect(copy.headers[0]?.id).not.toBe(source.headers[0]?.id);
    });

    test('is independent of the original', () => {
        const copy = duplicateProfile(source);
        copy.headers[0]!.value = 'someone-else';

        expect(source.headers[0]?.value).toBe('jdoe');
    });
});
