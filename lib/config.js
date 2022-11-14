'use strict';

const chalk = require('chalk');
const fs = require('fs');
const Configstore = require('configstore');
const { prompt } = require('enquirer');

const { name: pkgName, version: pkgVersion } = require('../package.json');
const Snyk = require('./snyk');

// _test_configStore is only exposed for testing purposes
const config = exports._test_configStore = new Configstore(pkgName);

const DEFAULTS = {
    projectName: null,
    ghLabels: null,
    severityLabel: true,
    parseManifestName: true,
    batch: true,
    minimumSeverity: 'medium',
    autoGenerate: false,
    save: false,
};

const ENV_FALLBACK = {
    snykToken: 'SNYK_TOKEN',
    ghPat: 'GH_PAT',
}

const help = `
Usage: snyk-github-issue-creator [options]

Normal options:

--yes, -y        Re-use previously saved configuration without asking.
--help, -h       Show this help.
--version, -v    Show release version.

Advanced options:

--snykOrg=...    The Snyk Organization UUID.
--snykProjects=...
                 A comma-separated list of Snyk project UUIDs.
--ghOwner=...    The name of the owner or organization under which the GitHub
                 repository is located.
--ghRepo=...     The name of the GitHub repository where issues should be
                 created.
--projectName=...
                 Alternative Snyk project name (optional).
--ghLabels=...   A comma-separated list of GitHub labels which will be applied
                 to new issues. The label "snyk" will always be applied
                 (optional).
--severityLabel, --no-severityLabel
                 If specified, the GitHub issue will have severity label(s)
                 added automatically. Default: Yes.
--parseManifestName, --no-parseManifestName
                 If specified, the dependency paths will start with the
                 manifest name instead of the project name. Default: Yes.
--batch, --no-batch
                 If specified, the selected findings will be combined into a
                 single GitHub issue. Default: Yes.
--minimumSeverity=...
                 If specified, vulnerabilities will only be displayed if they
                 meet the minimum severity level. Valid options are 'low',
                 'medium', 'high', or 'critical'. Default: 'medium'.
--autoGenerate, --no-autoGenerate
                 If specified, GitHub issues will be automatically generated
                 without a confirmation prompt. Default: No.
--dryRun         Do not create any GitHub issues or labels.
--stdin          Read Snyk Organization UUID and Snyk Project UUID from STDIN.
                 Used instead of --snykOrg/--snykProjects.

Supported Environment Variables:

SNYK_TOKEN   The Snyk API token.
GH_PAT       The GitHub Personal Access Token.
`;

const conf = (exports.conf = {}); // "Singleton" config object

exports.init = async (args) => {
    if (args.help || args.h) {
        console.log(help);
        return process.exit(0);
    } else if (args.version || args.v) {
        console.log(pkgVersion);
        return process.exit(0);
    }

    const yesMode = args.yes || args.y;
    let snykOrg, snykProjects;

    const getConfig = (name) => {
        const env = ENV_FALLBACK[name];
        return (env ? process.env[env] : args[name])
          ?? config.get(name)
          ?? DEFAULTS[name];
    };

    const shouldSkip = (name) => {
        if (yesMode) {
            // if --yes is used, skip any property were we have a value
            return getConfig(name) !== undefined;
        } else {
            // if --yes is not used, only skip properties where a value has
            // been explicitly provided, either via an environment variable or
            // command line arguments is present
            const env = ENV_FALLBACK[name];
            return env ? env in process.env : name in args;
        }
    };

    // snykOrg and snykProject either come from stdin, or from separate CLI arguments
    if (args.stdin) {
        const stdin = fs.readFileSync('/dev/stdin').toString();
        stdin.split('\n').forEach((line) => {
            const matched = line.match(
                /^Explore this snapshot at https:\/\/app.snyk.io\/org\/([^\/]+)\/project\/([^\/]+)\/.*/
            );
            if (matched && matched.length == 3) {
                snykOrg = matched[1];
                snykProjects = [matched[2]];
            }
        });
        if (!snykOrg || !snykProjects[0]) {
            console.error(
                chalk.red(
                    'Could not parse required Snyk Org and Snyk Project from stdin.'
                )
            );
            process.exit(1);
        }
    } else {
        snykOrg = getConfig('snykOrg');
        snykProjects = getConfig('snykProjects') || [];
    }

    Object.assign(
        conf,
        await prompt({
            type: 'input',
            name: 'snykToken',
            message: 'Snyk token',
            skip: shouldSkip('snykToken'),
            initial: getConfig('snykToken'),
            validate: required,
        })
    );

    const snyk = new Snyk({ token: conf.snykToken });

    if (shouldSkip('snykOrg') || 'stdin' in args) {
        conf.snykOrg = snykOrg;
    } else {
        Object.assign(
            conf,
            await prompt({
                type: 'select',
                name: 'snykOrg',
                message: 'Snyk organization',
                choices: (await snyk.orgs()).map((org) => ({
                    name: org.id,
                    message: org.name,
                })),
                initial: snykOrg,
            })
        );
    }

    if (shouldSkip('snykProjects') || 'stdin' in args) {
        conf.snykProjects = list(snykProjects);
    } else {
        const choices = (await snyk.projects(conf.snykOrg, snykProjects))
            .map(({ id, name, isMonitored, issueCountTotal }) => {
                const message = isMonitored
                    ? `${name} (${issueCountTotal} issues)`
                    : `[Inactive project] ${name}`;
                return { name: id, message, isMonitored };
            })
            .sort((choice1, choice2) => {
                if (choice1.isMonitored !== choice2.isMonitored) {
                    return choice1.isMonitored ? -1 : 1;
                }
                const { message: a } = choice1;
                const { message: b } = choice2;
                return a < b ? -1 : a > b ? 1 : 0;
            });
        // if any projects do not exist, filter those out the initial choices
        const initial = snykProjects.filter((id) =>
            choices.some((choice) => id === choice.name)
        );
        Object.assign(
            conf,
            await prompt({
                type: 'multiselect',
                name: 'snykProjects',
                message: 'Snyk project UUIDs',
                choices,
                initial,
            })
        );
    }

    Object.assign(
        conf,
        await prompt([
            {
                type: 'input',
                name: 'ghPat',
                message: 'GitHub Personal Access Token',
                skip: shouldSkip('ghPat'),
                initial: getConfig('ghPat'),
                validate: required,
            },
            {
                type: 'input',
                name: 'ghOwner',
                message: 'GitHub Owner',
                skip: shouldSkip('ghOwner'),
                initial: getConfig('ghOwner'),
                validate: required,
            },
            {
                type: 'input',
                name: 'ghRepo',
                message: 'GitHub Repo',
                skip: shouldSkip('ghRepo'),
                initial: getConfig('ghRepo'),
                validate: required,
            },
            {
                type: 'input',
                name: 'projectName',
                message: 'Project name',
                skip: shouldSkip('projectName'),
                initial: getConfig('projectName'),
            },
            {
                type: 'list',
                name: 'ghLabels',
                message: 'GitHub Labels',
                skip: shouldSkip('ghLabels'),
                initial: getConfig('ghLabels'),
                result: (labels) => {
                    labels.push('snyk');
                    return [...new Set(labels)];
                },
            },
            {
                type: 'confirm',
                name: 'severityLabel',
                message: 'Add severity labels to issues',
                skip: shouldSkip('severityLabel'),
                initial: getConfig('severityLabel'),
            },
            {
                type: 'confirm',
                name: 'parseManifestName',
                message: 'Parse manifest name',
                skip: shouldSkip('parseManifestName'),
                initial: getConfig('parseManifestName'),
            },
            {
                type: 'confirm',
                name: 'batch',
                message: 'Batch',
                skip: shouldSkip('batch'),
                initial: getConfig('batch'),
            },
            {
                type: 'select',
                name: 'minimumSeverity',
                message: 'Minimum severity',
                skip: shouldSkip('minimumSeverity'),
                initial: getConfig('minimumSeverity'),
                choices: SEVERITY_LEVELS,
            },
            {
                type: 'confirm',
                name: 'autoGenerate',
                message: 'Auto generate',
                skip: shouldSkip('autoGenerate'),
                initial: getConfig('autoGenerate'),
            },
            {
                type: 'confirm',
                name: 'save',
                message: 'Save settings',
                skip: shouldSkip('save'),
                initial: getConfig('save'),
            },
        ])
    );

    if (conf.save) config.set(conf);

    /**
     * Set any configuraiton below that shouldn't be persisted
     */
    if (args.dryRun) conf.dryRun = true;
};

const SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical'];

function required(value, { message }) {
    return value ? true : `${message} is required`;
}

function list(value) {
    return typeof value === 'string'
        ? value.split(',').map((s) => s.trim())
        : value;
}
