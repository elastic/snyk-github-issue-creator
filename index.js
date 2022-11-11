#!/usr/bin/env node
'use strict';

const args = require('minimist')(process.argv.slice(2));
const chalk = require('chalk');

const { init: initConfig } = require('./lib/config');
const getVulnerabilities = require('./lib/vulnerabilities');
const processVulnerabilities = require('./lib/process');

(async () => {
    await initConfig(args);
    await processVulnerabilities(await getVulnerabilities());
})().catch((err) => {
    console.error(chalk.red(err ? err.stack : 'Aborted!'));
    process.exit(1);
});
