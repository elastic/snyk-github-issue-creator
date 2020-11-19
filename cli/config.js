'use strict';

const args = require('minimist')(process.argv.slice(2));
const chalk = require('chalk');
const fs = require('fs');
const Configstore = require('configstore');
const { prompt } = require('enquirer');

const Snyk = require('./snyk');

const config = new Configstore(require('../package.json').name);

const help = `
Usage: snyk-github-issue-creator [options]

Options:

--help, -h   Show this help.
--stdin      Read Snyk org/projects from STDIN.
--auto       Re-use previously saved configuration.
`;

const conf = (exports.conf = {}); // "Singleton" config object

exports.init = async () => {
    if (args.help || args.h) {
        console.log(help);
        process.exit(0);
    } else if (args.auto) {
        Object.assign(conf, config.all);
        return;
    }

    let snykOrg, snykProjects;

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
        snykOrg = config.get('snykOrg');
        snykProjects = config.get('snykProjects');
    }

    Object.assign(
        conf,
        await prompt({
            type: 'input',
            name: 'snykToken',
            message: 'Snyk token',
            initial: config.get('snykToken'),
            validate: required,
        })
    );

    const snyk = new Snyk({ token: conf.snykToken });

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

    Object.assign(
        conf,
        await prompt([
            {
                type: 'multiselect',
                name: 'snykProjects',
                message: 'Snyk project UUIDs',
                choices: (await snyk.projects(conf.snykOrg)).map((p) => ({
                    name: p.id,
                    message: p.name,
                })),
                initial: snykProjects,
            },
            {
                type: 'input',
                name: 'ghPat',
                message: 'GitHub Personal Access Token',
                initial: config.get('ghPat'),
                validate: required,
            },
            {
                type: 'input',
                name: 'ghOwner',
                message: 'GitHub Owner',
                initial: config.get('ghOwner'),
                validate: required,
            },
            {
                type: 'input',
                name: 'ghRepo',
                message: 'GitHub Repo',
                initial: config.get('ghRepo'),
                validate: required,
            },
            {
                type: 'input',
                name: 'projectName',
                message: 'Project name',
                initial: config.get('projectName'),
            },
            {
                type: 'list',
                name: 'ghLabels',
                message: 'GitHub Labels',
                initial: config.get('ghLabels'),
            },
            {
                type: 'confirm',
                name: 'severityLabel',
                message: 'Add severity labels to issues',
                initial: config.get('severityLabel'),
            },
            {
                type: 'confirm',
                name: 'parseManifestName',
                message: 'Parse manifest name',
                initial: config.get('parseManifestName'),
            },
            {
                type: 'confirm',
                name: 'batch',
                message: 'Batch',
                initial: config.get('batch'),
            },
            {
                type: 'confirm',
                name: 'autoGenerate',
                message: 'Auto generate',
                initial: config.get('autoGenerate'),
            },
            {
                type: 'confirm',
                name: 'save',
                message: 'Save settings',
                initial: config.get('save'),
            },
        ])
    );

    if (conf.save) config.set(conf);
};

function required(value, { message }) {
    return value ? true : `${message} is required`;
}
