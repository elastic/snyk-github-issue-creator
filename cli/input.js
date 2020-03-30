const chalk = require('chalk');
const fs = require('fs');
const uuidValidate = require('uuid-validate');

const parseAndValidateInput = (args) => {
    const help =
        'Usage: snyk-github-issue-creator [--snykOrg=<snykOrg> --snykProject=<snykProject> | --stdin ] ' +
        '--ghOwner=<ghOwner> --ghRepo=<ghRepo> ' +
        '[--ghLabels=<ghLabel>,...] [--projectName=<projectName>] [--parseManifestName] [--batch] [--autoGenerate]';

    if (args.help || args.h) {
        console.log(help);
        return process.exit(0);
    }

    const errors = [];
    const parseArgument = (key, options) => {
        const { isEnvVar = false, errSuffix = '' } = options || {};
        const value = isEnvVar ? process.env[key] : args[key];
        if (!value) {
            const type = isEnvVar ? 'environment variable' : 'argument';
            errors.push(`"${key}" ${type} must be non-empty ${errSuffix}`);
        }
        return value;
    };

    const snykToken = parseArgument('SNYK_TOKEN', { isEnvVar: true });
    const ghPat = parseArgument('GH_PAT', { isEnvVar: true });
    const ghOwner = parseArgument('ghOwner');
    const ghRepo = parseArgument('ghRepo');
    let snykOrg;
    let snykProjects;

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
        if (
            typeof snykOrg === 'undefined' ||
            !snykOrg ||
            typeof snykProjects[0] === 'undefined' ||
            !snykProjects[0]
        ) {
            console.error(
                chalk.red(
                    'Could not parse required Snyk Org and Snyk Project from stdin.'
                )
            );
            process.exit(1);
        }
    } else {
        const errSuffix = 'if the "stdin" argument is not used';
        snykOrg = parseArgument('snykOrg', { errSuffix });
        snykProjects =
            args.snykProject &&
            args.snykProject.split(' ').filter((x) => uuidValidate(x));
        if (!snykProjects || !snykProjects.length) {
            errors.push(
                `"snykProject" argument must be one or more valid UUIDs (separated by spaces) ${errSuffix}`
            );
        }
    }

    if (errors.length > 0) {
        const delim = '\n  * ';
        console.error(
            chalk.red(`Invalid usage: ${delim}${errors.join(delim)}`)
        );
        console.log(help);
        return process.exit(1);
    }

    return { snykToken, ghPat, ghOwner, ghRepo, snykOrg, snykProjects };
};

module.exports = parseAndValidateInput;
