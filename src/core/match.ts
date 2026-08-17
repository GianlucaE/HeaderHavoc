/**
 * Local re-implementation of Chrome's urlFilter matching, used only by the URL
 * tester. Chrome's own verdict comes from testMatchOutcome; this exists to show
 * *which* pattern of a profile matched, which testMatchOutcome does not report.
 *
 * Regex patterns are evaluated with the JavaScript engine, which is a close but
 * imperfect stand-in for RE2 — the tester labels that difference rather than
 * hiding it.
 */

import type {Config, MatchMode, StoredPattern} from './types';

const SEPARATOR = '(?:[^a-zA-Z0-9_\\-.%]|$)';
const DOMAIN_ANCHOR = '^[a-z][a-z0-9+.-]*://(?:[^/?#]*\\.)?';

function escapeLiteral(char: string): string {
    return /[.*+?^${}()|[\]\\]/.test(char) ? `\\${char}` : char;
}

export function globToRegExp(filter: string): RegExp {
    let rest = filter;
    let prefix = '';
    let suffix = '';

    if (rest.startsWith('||')) {
        rest = rest.slice(2);
        prefix = DOMAIN_ANCHOR;
    } else if (rest.startsWith('|')) {
        rest = rest.slice(1);
        prefix = '^';
    }

    if (rest.endsWith('|')) {
        rest = rest.slice(0, -1);
        suffix = '$';
    }

    let body = '';
    for (const char of rest) {
        if (char === '*') {
            body += '.*';
        } else if (char === '^') {
            body += SEPARATOR;
        } else {
            body += escapeLiteral(char);
        }
    }

    return new RegExp(prefix + body + suffix, 'i');
}

export function matchesPattern(pattern: Pick<StoredPattern, 'value' | 'mode'>, url: string): boolean {
    const value = pattern.value.trim();
    if (value === '') {
        return false;
    }

    try {
        const expression = pattern.mode === 'regex' ? new RegExp(value, 'i') : globToRegExp(value);
        return expression.test(url);
    } catch {
        return false;
    }
}

export interface PatternVerdict {
    profileId: string;
    profileName: string;
    profileEnabled: boolean;
    patternValue: string;
    patternMode: MatchMode;
    matched: boolean;
}

export function evaluatePatterns(config: Config, url: string): PatternVerdict[] {
    return config.profiles.flatMap((profile) =>
        profile.urlPatterns
            .filter((pattern) => pattern.value.trim() !== '')
            .map((pattern) => ({
                profileId: profile.id,
                profileName: profile.name,
                profileEnabled: profile.enabled,
                patternValue: pattern.value.trim(),
                patternMode: pattern.mode,
                matched: matchesPattern(pattern, url),
            })),
    );
}
