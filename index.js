#!/usr/bin/env node
'use strict'

const args = require('minimist')(process.argv.slice(2))
const chalk = require('chalk')
const { prompt } = require('enquirer')

const { init: initConfig, conf } = require('./lib/config')
const github = require('./lib/github')
const selectVulnerabilities = require('./lib/select')
const getVulnerabilities = require('./lib/vulnerabilities');

(async () => {
  await initConfig(args)

  const vulnerabilities = await getVulnerabilities()

  do {
    await github.createIssues(
      await selectVulnerabilities(vulnerabilities),
      conf.autoGenerate && !conf.batch ? await github.existingIssues() : null
    )
  } while ((await prompt({
    type: 'confirm',
    name: 'pickAnother',
    message: 'Pick another issue?',
    skip: conf.autoGenerate
  })).pickAnother)
})().catch((err) => {
  console.error(chalk.red(err ? err.stack : 'Aborted!'))
  process.exit(1)
})
