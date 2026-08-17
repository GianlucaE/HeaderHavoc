import type {Config, Profile} from './types';

/**
 * Two enabled profiles that set the same header on the same URL pattern will
 * fight, and Chrome's tie-break decides silently. Detecting that in general is
 * undecidable, patterns can overlap without being equal, so this reports the
 * case we can prove: an identical pattern string. The URL tester gives the
 * exact answer for any specific URL.
 */
function sharedPattern(a: Profile, b: Profile): boolean {
    const patterns = new Set(a.urlPatterns.map((p) => p.value.trim().toLowerCase()).filter((v) => v !== ''));
    return b.urlPatterns.some((p) => patterns.has(p.value.trim().toLowerCase()));
}

function liveHeaderKeys(profile: Profile): Set<string> {
    return new Set(
        profile.headers
            .filter((h) => h.enabled && h.name.trim() !== '')
            .map((h) => `${h.target}:${h.name.trim().toLowerCase()}`),
    );
}

function describe(key: string, otherName: string): string {
    const name = key.slice(key.indexOf(':') + 1);
    return `"${name}" is also set by "${otherName}" on the same URL pattern. Chrome picks one — disable a profile to decide which.`;
}

export function findConflicts(config: Config): Map<string, string[]> {
    const conflicts = new Map<string, string[]>();
    if (!config.enabled) {
        return conflicts;
    }

    const live = config.profiles.filter((p) => p.enabled);
    const keys = new Map(live.map((profile) => [profile.id, liveHeaderKeys(profile)]));

    const add = (profileId: string, message: string): void => {
        const existing = conflicts.get(profileId);
        if (existing === undefined) {
            conflicts.set(profileId, [message]);
        } else if (!existing.includes(message)) {
            existing.push(message);
        }
    };

    for (let i = 0; i < live.length; i++) {
        for (let j = i + 1; j < live.length; j++) {
            const a = live[i];
            const b = live[j];
            if (a === undefined || b === undefined) {
                continue;
            }
            if (!sharedPattern(a, b)) {
                continue;
            }

            for (const key of keys.get(a.id) ?? []) {
                if (!(keys.get(b.id)?.has(key) ?? false)) {
                    continue;
                }
                add(a.id, describe(key, b.name));
                add(b.id, describe(key, a.name));
            }
        }
    }

    return conflicts;
}
