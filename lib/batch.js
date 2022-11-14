'use strict'

const { prompt } = require('enquirer')
const flatten = require('lodash.flatten')

const {
  capitalize,
  compare,
  uniq
} = require('./utils')

// Longest possible severity string. Each vulnerability in the prompt has a
// severity label that is padded out to this many characters
const SEVERITY_PREFIX_PADDING = 'M|1000'.length

module.exports = async (issues) => {
  const pkgNames = uniq(issues.map((x) => x.pkgName))

  if (pkgNames.length === 1) {
    return {
      pkgName: pkgNames[0],
      version: getBatchVersionString(issues),
      issues
    }
  }

  const reduced = issues.reduce((acc, cur) => {
    const { pkgName } = cur
    if (!acc[pkgName]) {
      acc[pkgName] = []
    }
    acc[pkgName].push(cur)
    return acc
  }, {})
  const choices = Object.entries(reduced).map(([pkgName, issues]) => {
    const severity = getBatchSeverityString(issues)
    const version = getBatchVersionString(issues)
    return `${severity} - ${pkgName} ${version}`
  })

  const { selected } = await prompt({
    type: 'select',
    name: 'selected',
    message: 'Pick a vulnerable package',
    choices
  })

  const trimmed = selected.slice(SEVERITY_PREFIX_PADDING + ' - '.length) // remove the severity prefix
  const pkgName = trimmed.substring(0, trimmed.indexOf(' '))
  const version = trimmed.substring(trimmed.indexOf(' ') + 1)
  const _issues = issues.filter((issue) => issue.pkgName === pkgName)
  return {
    pkgName,
    version,
    issues: _issues
  }
}

const getBatchSeverityString = (issues) => {
  // assume that the issues are already sorted in descending order of priority score
  const severity = capitalize(issues[0].issueData.severity[0]) // only use the severity level of the highest-scored issue
  const score = issues[0].priorityScore // only use the priority score of the highest-scored issue
  const severityText = `${severity}|${score}`
  const padding = ' '
    .repeat(SEVERITY_PREFIX_PADDING)
    .slice(severityText.length)
  return `${severityText}${padding}`
}

const getBatchVersionString = (issues) =>
  uniq(flatten(issues.map((x) => x.pkgVersions))).sort(compare.versions).join('/')
