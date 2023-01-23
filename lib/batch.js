'use strict'

const { prompt } = require('enquirer')
const flatten = require('lodash.flatten')

const {
  capitalize,
  compare,
  uniq
} = require('./utils')

module.exports = async (issues) => {
  const pkgNames = uniq(issues.map((x) => x.pkgName))

  if (pkgNames.length === 1) {
    return {
      pkgName: pkgNames[0],
      version: getBatchVersionString(issues),
      issues
    }
  }

  const columnWidth = []

  const choices = Object.entries(
      issues.reduce((acc, cur) => {
        const { pkgName } = cur
        if (!acc[pkgName]) {
          acc[pkgName] = []
        }
        acc[pkgName].push(cur)
        return acc
      }, {})
    )
    .map(([pkgName, issues]) => [
      pkgName,
      getSeverity(issues),
      getPriorityScoreString(issues),
      getBatchVersionString(issues),
      getNumberOfVulnerabilitiesString(issues)
    ])
    .map(updateColumnWidths)
    .map((columns) => ({
      name: columns.map((col, i) => col.padEnd(columnWidth[i], ' ')).join('  '),
      value: columns
    }))

  const { selected: { 0: pkgName, 3: version } } = await prompt({
    type: 'select',
    name: 'selected',
    message: 'Pick a vulnerable package',
    choices,
    format (selected) {
      // If `selected` is not an empty string, it means something has been selected.
      // If so, return a string we want to show as selected next to the `message`.
      return selected ? this.selected.value[0] : selected
    },
    result () {
      return this.selected.value
    }
  })

  return {
    pkgName,
    version,
    issues: issues.filter((issue) => issue.pkgName === pkgName)
  }

  function updateColumnWidths (columns) {
    columns.forEach((column, index) => {
      columnWidth[index] = Math.max(columnWidth[index] ?? 0, column.length)
    })
    return columns
  }
}

// Only use the severity level of the highest-scored issue (assumes issues are sorted in decending order of priority score)
function getSeverity (issues) {
  return capitalize(issues[0].issueData.severity)
}

// Only use the priority score of the highest-scored issue (assumes issues are sorted in decending order of priority score)
function getPriorityScoreString (issues) {
  return issues[0].priorityScore.toString(10)
}

function getBatchVersionString (issues) {
  return uniq(flatten(issues.map((x) => x.pkgVersions))).sort(compare.versions).join('/')
}

function getNumberOfVulnerabilitiesString (issues) {
  return `${issues.length} vulnerabilit${issues.length === 1 ? 'y' : 'ies'}`
}