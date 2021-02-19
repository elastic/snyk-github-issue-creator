'use strict';

const chalk = require('chalk');
const fs = require('fs');
const Configstore = require('configstore');
const { prompt } = require('enquirer');

const { name: pkgName, version: pkgVersion } = require('../package.json');
const Snyk = require('./snyk');

const config = new Configstore(pkgName);

const help = `
Usage: snyk-github-issue-creator [options]

Normal options:

--auto           Re-use previously saved configuration without asking.
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
                 Alternative Snyk project name.
--ghLabels=...   A comma-separated list of GitHub labels which will be applied
                 to new issues (the label "Snyk" will always be applied).
--severityLabel, --no-severityLabel
                 If specified, the GitHub issue will have severity label(s)
                 added automatically.
--parseManifestName, --no-parseManifestName
                 If specified, the dependency paths will start with the
                 manifest name instead of the project name.
--batch, --no-batch
                 If specified, the selected findings will be combined into a
                 single GitHub issue.
--minimumSeverity=...
                 If specified, vulnerabilities will only be displayed if they
                 meet the minimum severity level. Valid options are 'low',
                 'medium', or 'high'. Default is 'medium' (if using --auto and
                 you have not saved this setting previously).
--autoGenerate, --no-autoGenerate
                 If specified, GitHub issues will be automatically generated
                 without a confirmation prompt.
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
    } else if (args.auto) {
        Object.assign(conf, config.all);
        return;
    }

    let snykOrg, snykProjects;
    const getConfig = (name, { env } = {}) => {
        return (env ? process.env[env] : args[name]) ?? config.get(name);
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
        snykProjects = getConfig('snykProjects');
    }

    Object.assign(
        conf,
        await prompt({
            type: 'input',
            name: 'snykToken',
            message: 'Snyk token',
            skip: 'SNYK_TOKEN' in process.env,
            initial: getConfig('snykToken', { env: 'SNYK_TOKEN' }),
            validate: required,
        })
    );

    const snyk = new Snyk({ token: conf.snykToken });

    if ('snykOrg' in args || 'stdin' in args) {
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

    if ('snykProjects' in args || 'stdin' in args) {
        conf.snykProjects = list(snykProjects);
    } else {
        Object.assign(
            conf,
            await prompt({
                type: 'multiselect',
                name: 'snykProjects',
                message: 'Snyk project UUIDs',
                choices: (await snyk.projects(conf.snykOrg))
                    .map((p) => ({
                        name: p.id,
                        message: p.name,
                    }))
                    .sort(({ message: a }, { message: b }) =>
                        a < b ? -1 : a > b ? 1 : 0
                    ),
                initial: snykProjects,
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
                skip: 'GH_PAT' in process.env,
                initial: getConfig('ghPat', { env: 'GH_PAT' }),
                validate: required,
            },
            {
                type: 'input',
                name: 'ghOwner',
                message: 'GitHub Owner',
                skip: 'ghOwner' in args,
                initial: getConfig('ghOwner'),
                validate: required,
            },
            {
                type: 'input',
                name: 'ghRepo',
                message: 'GitHub Repo',
                skip: 'ghRepo' in args,
                initial: getConfig('ghRepo'),
                validate: required,
            },
            {
                type: 'input',
                name: 'projectName',
                message: 'Project name',
                skip: 'projectName' in args,
                initial: getConfig('projectName'),
            },
            {
                type: 'list',
                name: 'ghLabels',
                message: 'GitHub Labels',
                skip: 'ghLabels' in args,
                initial: getConfig('ghLabels'),
            },
            {
                type: 'confirm',
                name: 'severityLabel',
                message: 'Add severity labels to issues',
                skip: 'severityLabel' in args,
                initial: getConfig('severityLabel'),
            },
            {
                type: 'confirm',
                name: 'parseManifestName',
                message: 'Parse manifest name',
                skip: 'parseManifestName' in args,
                initial: getConfig('parseManifestName'),
            },
            {
                type: 'confirm',
                name: 'batch',
                message: 'Batch',
                skip: 'batch' in args,
                initial: getConfig('batch'),
            },
            {
                type: 'select',
                name: 'minimumSeverity',
                message: 'Minimum severity',
                skip: 'minimumSeverity' in args,
                initial: getConfig('minimumSeverity'),
                choices: SEVERITY_LEVELS,
            },
            {
                type: 'confirm',
                name: 'autoGenerate',
                message: 'Auto generate',
                skip: 'autoGenerate' in args,
                initial: getConfig('autoGenerate'),
            },
            {
                type: 'confirm',
                name: 'save',
                message: 'Save settings',
                skip: 'save' in args,
                initial: getConfig('save'),
            },
        ])
    );

    if (conf.save) config.set(conf);
};

const SEVERITY_LEVELS = ['low', 'medium', 'high'];

function required(value, { message }) {
    return value ? true : `${message} is required`;
}

function list(value) {
    return typeof value === 'string'
        ? value.split(',').map((s) => s.trim())
        : value;
}
