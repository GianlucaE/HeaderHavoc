import {describe, expect, test} from 'vitest';
import {matchesPattern} from '../src/core/match';
import type {MatchMode} from '../src/core/types';

function matches(value: string, url: string, mode: MatchMode = 'glob'): boolean {
    return matchesPattern({value, mode}, url);
}

describe('glob patterns', () => {
    test('a bare hostname matches anywhere in the URL', () => {
        expect(matches('example.com', 'https://example.com/some/path')).toBe(true);
        expect(matches('example.com', 'https://cdn.example.com/a.png')).toBe(true);
    });

    test('distinguishes two hosts that share a suffix', () => {
        const url = 'https://orders-proxy-dev.apps.example.com/';

        expect(matches('orders-proxy-dev.apps.example.com', url)).toBe(true);
        expect(matches('forms-proxy-dev.apps.example.com', url)).toBe(false);
    });

    test('* matches any run of characters', () => {
        expect(matches('api-gateway-*.example.com', 'https://api-gateway-01.example.com/x')).toBe(true);
        expect(matches('api-gateway-*.example.com', 'https://other.example.com/x')).toBe(false);
    });

    test('|| anchors a domain and allows subdomains', () => {
        expect(matches('||example.com', 'https://example.com/a')).toBe(true);
        expect(matches('||example.com', 'https://sub.example.com/a')).toBe(true);
        expect(matches('||example.com', 'https://notexample.com/a')).toBe(false);
    });

    test('a leading | anchors the start of the URL', () => {
        expect(matches('|https://example.com', 'https://example.com/a')).toBe(true);
        expect(matches('|example.com', 'https://example.com/a')).toBe(false);
    });

    test('a trailing | anchors the end of the URL', () => {
        expect(matches('example.com/done|', 'https://example.com/done')).toBe(true);
        expect(matches('example.com/done|', 'https://example.com/done/more')).toBe(false);
    });

    test('^ matches a separator character or the end of the URL', () => {
        expect(matches('example.com^', 'https://example.com/path')).toBe(true);
        expect(matches('example.com^', 'https://example.com')).toBe(true);
        expect(matches('example.com^', 'https://example.com.evil.net/')).toBe(false);
    });

    test('matches case-insensitively, as Chrome does by default', () => {
        expect(matches('EXAMPLE.com', 'https://example.com/')).toBe(true);
    });

    test('treats regex metacharacters as literal text', () => {
        expect(matches('a.b+c', 'https://x/a.b+c')).toBe(true);
        expect(matches('a.b+c', 'https://x/aXbbc')).toBe(false);
    });
});

describe('regex patterns', () => {
    test('matches an RE2-style expression against the whole URL', () => {
        const pattern = '^https://api\\.(dev|qa)\\.example\\.com/.*';

        expect(matches(pattern, 'https://api.dev.example.com/v1/users', 'regex')).toBe(true);
        expect(matches(pattern, 'https://api.prod.example.com/v1/users', 'regex')).toBe(false);
    });

    test('returns false for an expression JavaScript cannot compile', () => {
        expect(matches('([unterminated', 'https://example.com/', 'regex')).toBe(false);
    });
});

describe('empty input', () => {
    test.each(['', '   '])('never matches on a blank pattern (%j)', (value) => {
        expect(matches(value, 'https://example.com/')).toBe(false);
    });
});
