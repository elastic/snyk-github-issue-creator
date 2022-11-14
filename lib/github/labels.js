'use strict'

const { conf } = require('../config')
const { uniq } = require('../utils')

const LABELS = {
  snyk: {
    description: 'Issue reported by Snyk Open Source scanner',
    color: '70389f'
  },
  'severity:critical': {
    description: 'Critical severity rating',
    color: '990000'
  },
  'severity:high': {
    description: 'High severity rating',
    color: 'b31a6b'
  },
  'severity:medium': {
    description: 'Medium severity rating',
    color: 'df8620'
  },
  'severity:low': {
    description: 'Low severity rating',
    color: '595775'
  }
}
const DEFAULT_LABEL = {
  description: '',
  color: 'ffffff'
}

const getLabels = (issueOrIssues) => {
  let labels = [...conf.ghLabels]
  if (conf.severityLabel) {
    const issues = Array.isArray(issueOrIssues)
      ? issueOrIssues
      : [issueOrIssues]
    const severities = uniq(
      issues.map((x) => `severity:${x.issueData.severity}`)
    )
    labels = labels.concat(severities)
  }
  return labels
}

const getLabelAttributes = (name) => {
  return { name, ...(LABELS[name] || DEFAULT_LABEL) }
}

const ensureLabelsAreCreated = async (client, ghOwner, ghRepo, issues) => {
  const labels = getLabels(issues)
  const response = await client.issues.listLabelsForRepo({
    owner: ghOwner,
    repo: ghRepo,
    per_page: 100
  })
  const currentLabels = response.data.map((x) => x.name)
  const labelsToCreate = labels.filter((x) => !currentLabels.includes(x))
  if (!labelsToCreate.length || conf.dryRun) {
    return
  }

  await Promise.all(
    labelsToCreate.map((name) =>
      client.issues
        .createLabel({
          owner: ghOwner,
          repo: ghRepo,
          ...getLabelAttributes(name)
        })
        .then(() => {
          console.log(`Created GitHub label: "${name}"`)
        })
    )
  )
}

module.exports = { getLabels, ensureLabelsAreCreated }
