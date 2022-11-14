'use strict'

const chalk = require('chalk')

const { conf } = require('../config')

module.exports = async (vulnerabilities) => {
  const len = vulnerabilities.length
  console.log(chalk.grey(
    conf.batch
      ? `Auto-generating a single GitHub issue for ${len} issue${len > 1 ? 's' : ''}`
      : `Auto-generating ${len} GitHub issue${len > 1 ? 's' : ''}...`
  ))
  return vulnerabilities
}
