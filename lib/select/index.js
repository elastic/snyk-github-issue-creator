'use strict'

const getBatchProps = require('../batch')
const { conf } = require('../config')
const autoGenerate = require('./auto-generate')
const manualSelection = require('./manual-selection')

module.exports = async (vulnerabilities) => {
  if (conf.batch) {
    // filter down to the package that was picked
    vulnerabilities = (await getBatchProps(vulnerabilities)).issues
  }

  if (conf.autoGenerate) {
    return await autoGenerate(vulnerabilities)
  } else {
    return await manualSelection(vulnerabilities)
  }
}
