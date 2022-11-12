'use strict';

const os = require('os');
const { join } = require('path');
const test = require('tape');

const { init, conf, _test_configStore: configStore } = require('../lib/config');

// Hack: override the internal path to the config file so we can use a different one for testing
configStore.path = join(__dirname, 'configstore.json');

test('should have empty conf by default', (t) => {
    t.deepEqual(conf, {});
    t.end();
});

['h', 'help'].forEach((opt) => {
    test(`"${opt}" option should show help and exit`, async (t) => {
        t.plan(2);

        resetConf();

        patch(process, 'exit', (code) => {
            t.equal(code, 0);
            t.end();
        });

        patch(console, 'log', (str) => {
            t.equal(
                str.split(os.EOL)[1],
                'Usage: snyk-github-issue-creator [options]'
            );
        });

        await init({ [opt]: true });
    });
});

['v', 'version'].forEach((opt) => {
    test(`"${opt}" option should show version and exit`, async (t) => {
        t.plan(2);

        resetConf();

        patch(process, 'exit', (code) => {
            t.equal(code, 0);
            t.end();
        });

        patch(console, 'log', (str) => {
            t.equal(str, require('../package.json').version);
        });

        await init({ [opt]: true });
    });
});

test('should read test-only configstore json file', async (t) => {
    resetConf();
    t.deepEqual(conf, {});
    await init({ y: true });
    t.deepEqual(conf, {
        snykToken: '_configstore_snykToken_',
        snykOrg: '_configstore_snykOrg_',
        snykProjects: ['_configstore_snykProject1_', '_configstore_snykProject2_'],
        ghPat: '_configstore_ghPat_',
        ghOwner: '_configstore_owner_',
        ghRepo: '_configstore_repo_',
        projectName: '_configstore_projectName_',
        ghLabels: ['_configstore_label1_', '_configstore_label2_', 'snyk'],
        severityLabel: true,
        parseManifestName: true,
        batch: true,
        minimumSeverity: 'medium',
        autoGenerate: false,
        save: false
    });
    t.end();
});

test('should be able to override saved config using environment variables and command line arguments', async (t) => {
    resetConf();

    process.env.SNYK_TOKEN = 'from_env';

    await init({ y: true, snykProjects: 'foo,bar', ghOwner: 'baz' });

    delete process.env.SNYK_TOKEN;

    t.deepEqual(conf, {
        snykToken: 'from_env',
        snykOrg: '_configstore_snykOrg_',
        snykProjects: ['foo', 'bar'],
        ghPat: '_configstore_ghPat_',
        ghOwner: 'baz',
        ghRepo: '_configstore_repo_',
        projectName: '_configstore_projectName_',
        ghLabels: ['_configstore_label1_', '_configstore_label2_', 'snyk'],
        severityLabel: true,
        parseManifestName: true,
        batch: true,
        minimumSeverity: 'medium',
        autoGenerate: false,
        save: false
    });

    t.end();
});

test('certain config options should only be configurale via environment variables', async (t) => {
    resetConf();

    process.env.SNYK_TOKEN = 'snyktoken-via-env';
    process.env.GH_PAT = 'ghpat-via-env';

    await init({
        y: true,
        snykToken: 'snyktoken-via-args',
        ghPat: 'ghpat-via-args',
    });

    delete process.env.SNYK_TOKEN;
    delete process.env.GH_PAT;

    t.equal(conf.snykToken, 'snyktoken-via-env');
    t.equal(conf.ghPat, 'ghpat-via-env');
    t.end();
});

test('should be 100% configurable by cli arguments', async (t) => {
    resetConf();

    process.env.SNYK_TOKEN = '_snykToken_';
    process.env.GH_PAT = '_ghPat_';

    await init({
        snykOrg: '_snykOrg_',
        snykProjects: '_snykProject1_,_snykProject2_',
        ghOwner: '_ghOwner_',
        ghRepo: '_ghRepo_',
        projectName: '_projectName_',
        ghLabels: '_ghLabel1_,_ghLabel2_',
        severityLabel: false,
        parseManifestName: true,
        batch: false,
        minimumSeverity: '_minimumSeverity_',
        autoGenerate: true,
        save: false,
    });

    delete process.env.SNYK_TOKEN;
    delete process.env.GH_PAT;

    t.deepEqual(conf, {
        snykToken: '_snykToken_',
        snykOrg: '_snykOrg_',
        snykProjects: ['_snykProject1_', '_snykProject2_'],
        ghPat: '_ghPat_',
        ghOwner: '_ghOwner_',
        ghRepo: '_ghRepo_',
        projectName: '_projectName_',
        ghLabels: ['_ghLabel1_', '_ghLabel2_', 'snyk'],
        severityLabel: false,
        parseManifestName: true,
        batch: false,
        minimumSeverity: '_minimumSeverity_',
        autoGenerate: true,
        save: false,
    });
    t.end();
});

test('should be able to set only required cli arguments and fall back to defaults of all other options when using --yes', async (t) => {
    resetConf();
    configStore.path = join(__dirname, 'this-file-does-not-exist');

    process.env.SNYK_TOKEN = '_snykToken_';
    process.env.GH_PAT = '_ghPat_';

    await init({
        y: true,
        snykToken: '_snykToken_', // should not be allowed to be set via command line args
        snykOrg: '_snykOrg_',
        snykProjects: ['_snykProject1_', '_snykProject2_'],
        ghPat: '_ghPat_', // should not be allowed to be set via command line args
        ghOwner: '_ghOwner_',
        ghRepo: '_ghRepo_',
    });

    delete process.env.SNYK_TOKEN;
    delete process.env.GH_PAT;

    t.deepEqual(conf, {
        snykToken: '_snykToken_',
        snykOrg: '_snykOrg_',
        snykProjects: ['_snykProject1_', '_snykProject2_'],
        ghPat: '_ghPat_',
        ghOwner: '_ghOwner_',
        ghRepo: '_ghRepo_',
        projectName: '', // initial value of `null` will be turned in an empty string by enquirer
        ghLabels: ['snyk'],
        severityLabel: true,
        parseManifestName: true,
        batch: true,
        minimumSeverity: 'medium',
        autoGenerate: false,
        save: false,
    });
    t.end();
});

test('should be able to reset conf between tests', (t) => {
    resetConf();
    t.deepEqual(conf, {});
    t.end();
});

function patch(target, fnName, cb) {
    const orig = target[fnName];
    target[fnName] = (...args) => {
        target[fnName] = orig;
        cb.apply(target, args);
    };
}

function resetConf() {
    for (const key of Object.keys(conf)) {
        delete conf[key];
    }
}
