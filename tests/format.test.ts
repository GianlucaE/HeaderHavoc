import {describe, expect, test} from 'vitest';
import {plural} from '../src/ui/format';

describe('plural', () => {
    test.each([
        [0, 'rule', undefined, '0 rules'],
        [1, 'rule', undefined, '1 rule'],
        [2, 'rule', undefined, '2 rules'],
        [1, 'match', 'matches', '1 match'],
        [3, 'match', 'matches', '3 matches'],
    ])('%i %s → %s', (count, word, many, expected) => {
        expect(plural(count, word, many)).toBe(expected);
    });
});
