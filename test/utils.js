'use strict';

const test = require('tape');

const { conf } = require('../lib/config');
const { capitalize, compare, uniq } = require('../lib/utils');

test('compare.text', (t) => {
    t.equal(compare.text('aaa', 'aaa'), 0);
    t.equal(compare.text('aaa', 'AAA'), 0);
    t.equal(compare.text('aaa', 'bbb'), -1);
    t.equal(compare.text('bbb', 'aaa'), 1);
    t.end();
});

test('compare.arrays', (t) => {
    t.equal(compare.arrays(['aaa'], ['aaa']), compare.text('aaa', 'aaa'));
    t.equal(compare.arrays(['aaa'], ['AAA']), compare.text('aaa', 'AAA'));
    t.equal(compare.arrays(['aaa'], ['bbb']), compare.text('aaa', 'bbb'));
    t.equal(compare.arrays(['bbb'], ['aaa']), compare.text('bbb', 'aaa'));

    t.equal(compare.arrays(['a', 'b', 'c'], ['a', 'b', 'c']), compare.text('abc', 'abc'));
    t.equal(compare.arrays(['c', 'b', 'a'], ['a', 'b', 'c']), compare.text('cba', 'abc'));
    t.equal(compare.arrays(['a', 'b', 'c'], ['c', 'b', 'a']), compare.text('abc', 'cba'));

    t.end();
});

test('compare.severities', (t) => {
    t.equal(compare.severities('critical', 'critical'), 0);
    t.equal(compare.severities('critical', 'high'), -1);
    t.equal(compare.severities('critical', 'medium'), -1);
    t.equal(compare.severities('critical', 'low'), -1);

    t.equal(compare.severities('high', 'critical'), 1);
    t.equal(compare.severities('high', 'high'), 0);
    t.equal(compare.severities('high', 'medium'), -1);
    t.equal(compare.severities('high', 'low'), -1);

    t.equal(compare.severities('medium', 'critical'), 1);
    t.equal(compare.severities('medium', 'high'), 1);
    t.equal(compare.severities('medium', 'medium'), 0);
    t.equal(compare.severities('medium', 'low'), -1);

    t.equal(compare.severities('low', 'critical'), 1);
    t.equal(compare.severities('low', 'high'), 1);
    t.equal(compare.severities('low', 'medium'), 1);
    t.equal(compare.severities('low', 'low'), 0);

    t.end();
});

test('compare.versions', (t) => {
    t.equal(compare.versions('1', '1'), 0);
    t.equal(compare.versions('1', '2'), 1);
    t.equal(compare.versions('2', '1'), -1);

    t.equal(compare.versions('1.2', '1.2'), 0);
    t.equal(compare.versions('1.2', '1.3'), 1);
    t.equal(compare.versions('1.3', '1.2'), -1);

    t.equal(compare.versions('1.2.3', '1.2.3'), 0);
    t.equal(compare.versions('1.2.3', '1.2.4'), 1);
    t.equal(compare.versions('1.2.4', '1.2.3'), -1);

    t.equal(compare.versions('1.2.3.4', '1.2.3.4'), 0);
    t.equal(compare.versions('1.2.3.4', '1.2.4.5'), 1);
    t.equal(compare.versions('1.2.3.5', '1.2.3.4'), -1);

    t.end();
});

test('compare.versionArrays', (t) => {
    t.equal(compare.versionArrays(['1.2.3'], ['1.2.3']), compare.versions('1.2.3', '1.2.3'));
    t.equal(compare.versionArrays(['1.2.3'], ['1.2.4']), compare.versions('1.2.3', '1.2.4'));
    t.equal(compare.versionArrays(['1.2.4'], ['1.2.3']), compare.versions('1.2.4', '1.2.3'));

    t.equal(compare.versionArrays(['1.2.3', '2.0.0'], ['1.2.3']), compare.versions('2.0.0', '1.2.3'));
    t.equal(compare.versionArrays(['2.0.0', '1.2.3'], ['1.2.3']), compare.versions('2.0.0', '1.2.3'));
    t.equal(compare.versionArrays(['1.2.3'], ['1.2.3', '2.0.0']), compare.versions('1.2.3', '2.0.0'));
    t.equal(compare.versionArrays(['1.2.3'], ['2.0.0', '1.2.3']), compare.versions('1.2.3', '2.0.0'));

    t.end();
});

test('capitalize', (t) => {
    t.test('non string', (t) => {
        t.equal(capitalize(null), '');
        t.equal(capitalize(undefined), '');
        t.equal(capitalize(42), '');
        t.equal(capitalize({}), '');
        t.end();
    });

    t.test('string', (t) => {
        t.equal(capitalize('peter pan'), 'Peter pan');
        t.end();
    });
});

test('uniq', (t) => {
    t.deepEqual(uniq([]), []);
    t.deepEqual(uniq([1, 2, 3, 2]), [1, 2, 3]);
    t.deepEqual(uniq([{ foo: 1 }, { bar: 2 }, { baz: 3 }, { bar: 2 }]), [{ foo: 1 }, { bar: 2 }, { baz: 3 }, { bar: 2 }]);

    const foo = { foo: 1 };
    const bar = { bar: 2 };
    const baz = { baz: 3 };
    t.deepEqual(uniq([foo, bar, baz, bar]), [{ foo: 1 }, { bar: 2 }, { baz: 3 }]);

    t.end();
});
