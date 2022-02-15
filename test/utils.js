'use strict';

const test = require('tape');

const { conf } = require('../cli/config');
const { capitalize, compare, uniq, getProjectName, getUniqueProjectNamePrefixes, getGraph } = require('../cli/utils');

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
    t.equal(compare.versions('1.2.3', '1.2.3'), 0);
    t.equal(compare.versions('1.2.3', '1.2.4'), 1);
    t.equal(compare.versions('1.2.4', '1.2.3'), -1);
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

test('getProjectName', (t) => {
    t.equal(getProjectName({ name: 'foo' }), 'foo');
    t.equal(getProjectName([{ name: 'foo' }]), 'foo');
    t.equal(getProjectName([{ name: 'foo' }, { name: 'bar' }]), '2 projects');

    conf.projectName = 'custom';
    t.equal(getProjectName({ name: 'foo' }), 'custom');
    t.equal(getProjectName([{ name: 'foo' }]), 'custom');
    t.equal(getProjectName([{ name: 'foo' }, { name: 'bar' }]), 'custom');
    delete conf.projectName;

    t.end();
});

test('getUniqueProjectNamePrefixes', (t) => {
    t.deepEqual(getUniqueProjectNamePrefixes([{ name: 'a:b' }, { name: 'c:d' }]), new Set(['a', 'c']));
    t.end();
});

test('getGraph', (t) => {
    t.test('with few paths', (t) => {
        const issue = {
            from: [
                {
                    project: { name: 'elastic/kibana(6.8):package.json' },
                    paths: [
                        [{ name: 'angular', version: '1.6.9' }],
                        [
                            { name: 'angular-elastic', version: '2.5.0' },
                            { name: 'angular', version: '1.6.9' }
                        ]
                    ]
                },
                {
                    project: { name: 'elastic/kibana(6.8):x-pack/package.json' },
                    paths: [
                        [{ name: 'angular', version: '1.6.9' }]
                    ]
              }
          ]
        };
        const prefix = ' * ';
        const showFullManifest = false;

        t.equal(
            getGraph(issue, prefix, showFullManifest),
            ' * elastic/kibana(6.8):package.json > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > angular-elastic@2.5.0 > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):x-pack/package.json > angular@1.6.9'
        );

        t.end();
    });

    t.test('with many paths with different direct dependencies', (t) => {
        const issue = {
            from: [
                {
                    project: { name: 'elastic/kibana(6.8):package.json' },
                    paths: []
                },
                {
                    project: { name: 'elastic/kibana(6.8):x-pack/package.json' },
                    paths: [
                        [{ name: 'angular', version: '1.6.9' }]
                    ]
              }
          ]
        };
        const prefix = ' * ';
        const showFullManifest = false;

        for (let n = 0; n < 20; n++) {
            const path = [];

            // the first run we only want angular as a direct dependency
            if (n > 0) {
                // on the second run we want angular as a direct dependency of a direct dependency
                path.push({ name: `direct-dependency${n}`, version: '1.0.0' });
                for (let depth = 1; depth < n; depth++) {
                    // on all subsequent runs with want transitive dependencies
                    path.push({ name: `transitive-dependency${n}-${depth}`, version: '1.0.0' });
                }
            }

            path.push({ name: 'angular', version: '1.6.9' });

            issue.from[0].paths.push(path);
        }

        t.equal(
            getGraph(issue, prefix, showFullManifest),
            ' * elastic/kibana(6.8):package.json > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency1@1.0.0 > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency2@1.0.0 > ... > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency3@1.0.0 > ... > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency4@1.0.0 > ... > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency5@1.0.0 > ... > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency6@1.0.0 > ... > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency7@1.0.0 > ... > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency8@1.0.0 > ... > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency9@1.0.0 > ... > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency10@1.0.0 > ... > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency11@1.0.0 > ... > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency12@1.0.0 > ... > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency13@1.0.0 > ... > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency14@1.0.0 > ... > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency15@1.0.0 > ... > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency16@1.0.0 > ... > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency17@1.0.0 > ... > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency18@1.0.0 > ... > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency19@1.0.0 > ... > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):x-pack/package.json > angular@1.6.9'
        );

        t.end();
    });

    t.test('with many paths with same direct dependencies', (t) => {
        const issue = {
            from: [
                {
                    project: { name: 'elastic/kibana(6.8):package.json' },
                    paths: []
                },
                {
                    project: { name: 'elastic/kibana(6.8):x-pack/package.json' },
                    paths: [
                        [{ name: 'angular', version: '1.6.9' }]
                    ]
              }
          ]
        };
        const prefix = ' * ';
        const showFullManifest = false;

        for (let n = 0; n < 20; n++) {
            const path = [];

            // the first run we only want angular as a direct dependency
            if (n > 0) {
                // on the second run we want angular as a direct dependency of a direct dependency
                path.push({ name: `direct-dependency`, version: '1.0.0' });
                for (let depth = 1; depth < n; depth++) {
                    // on all subsequent runs with want transitive dependencies
                    path.push({ name: `transitive-dependency${n}-${depth}`, version: '1.0.0' });
                }
            }

            path.push({ name: 'angular', version: '1.6.9' });

            issue.from[0].paths.push(path);
        }

        t.equal(
            getGraph(issue, prefix, showFullManifest),
            ' * elastic/kibana(6.8):package.json > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency@1.0.0 > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):package.json > direct-dependency@1.0.0 > ... (x18) > angular@1.6.9\r\n' +
            ' * elastic/kibana(6.8):x-pack/package.json > angular@1.6.9'
        );

        t.end();
    });
});