'use strict';

const test = require('tape');

const { conf } = require('../../lib/config');
const { getProjectName, getUniqueProjectNamePrefixes, getGraph } = require('../../lib/github/utils');

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