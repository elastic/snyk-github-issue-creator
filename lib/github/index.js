'use strict'

const { Octokit } = require('@octokit/rest')
const { throttling } = require('@octokit/plugin-throttling')
const chalk = require('chalk')

const getBatchIssue = require('./batch')
const { conf } = require('../config')
const { getProjectName, getGraph } = require('./utils')
const { dressError } = require('../utils')

const { getLabels, ensureLabelsAreCreated } = require('./labels')

let octokit = null

module.exports = {
  get client () {
    if (octokit === null) {
      octokit = init()
    }
    return octokit.rest
  },

  // retrieve issue IDs already created in GitHub
  async existingIssues () {
    try {
      return await octokit.paginate(
        `GET /search/issues?q=repo%3A${conf.ghOwner}/${conf.ghRepo}+is%3Aissue+label%3Asnyk`,
        (response) =>
          response.data.map((existingIssue) => [
            existingIssue.title,
            existingIssue.number
          ])
      )
    } catch (err) {
      throw new Error(dressError(err, `Failed to paginate octakit request for existing issues in repository ${conf.ghRepo}`))
    }
  },

  async createIssue (options) {
    if (conf.dryRun) return
    try {
      return await this.client.issues.create(options)
    } catch (err) {
      throw new Error(dressError(err, `Failed to ${options.issue_number ? 'update' : 'create'} issue: ${options.issue_number ? options.issue_number : options.title}`))
    }
  },

  async createIssues (issues, existingIssues) {
    let ghNewIssues = []
    let ghUpdatedIssues = []

    if (issues.length > 0) {
      await ensureLabelsAreCreated(octokit, this.client, conf.ghOwner, conf.ghRepo, issues)

      if (conf.batch) {
        ghNewIssues = [await this.createIssue({
          owner: conf.ghOwner,
          repo: conf.ghRepo,
          ...await getBatchIssue(issues),
          labels: getLabels(issues)
        })].filter(filterUndefined)
      } else {
        existingIssues = new Map(existingIssues)

        const newIssues = issues.filter(
          (issue) => !existingIssues.has(getIssueTitle(issue))
        )
        const updateIssues = issues.filter((issue) =>
          existingIssues.has(getIssueTitle(issue))
        )

        ghNewIssues = (await Promise.all(
          newIssues.map((issue) =>
            this.createIssue({
              owner: conf.ghOwner,
              repo: conf.ghRepo,
              title: getIssueTitle(issue),
              body: getIssueBody(issue),
              labels: getLabels(issue)
            })
          )
        )).filter(filterUndefined)

        ghUpdatedIssues = (await Promise.all(
          updateIssues.map((issue) =>
            this.createIssue({
              owner: conf.ghOwner,
              repo: conf.ghRepo,
              issue_number: existingIssues.get(getIssueTitle(issue)),
              body: getIssueBody(issue)
            })
          )
        )).filter(filterUndefined)
      }
    }

    if (ghNewIssues.length === 0 && ghUpdatedIssues.length === 0) {
      console.log(chalk.green('No GitHub issues were created/updated'))
    } else {
      if (ghUpdatedIssues.length !== 0) {
        console.log(
          chalk.green('The following GitHub issues were updated:')
        )
        ghUpdatedIssues.forEach((ghIssue) => {
          console.log(
                        `- "${ghIssue.data.title}" ${ghIssue.data.url.replace(
                            'api.github.com/repos',
                            'github.com'
                        )}`
          )
        })
      }

      if (ghNewIssues.length !== 0) {
        console.log(
          chalk.green('The following GitHub issues were created:')
        )
        ghNewIssues.forEach((ghIssue) => {
          console.log(
                        `- "${ghIssue.data.title}" ${ghIssue.data.url.replace(
                            'api.github.com/repos',
                            'github.com'
                        )}`
          )
        })
      }
    }
  }
}

function init () {
  const ThrottledOctokit = Octokit.plugin(throttling)
  return new ThrottledOctokit({
    auth: conf.ghPat,
    userAgent: `${conf.ghOwner} ${conf.ghRepo}`,
    throttle: {
      onRateLimit: (retryAfter, options) => {
        console.warn(
          chalk.yellow(
                        `Request quota exhausted for request ${options.method} ${options.url}`
          )
        )

        if (options.request.retryCount === 0) {
          // only retries once
          console.log(`Retrying after ${retryAfter} seconds!`)
          return true
        }
      },
      onAbuseLimit: (retryAfter, options) => {
        // does not retry, only logs a warning
        console.warn(
          chalk.yellow(
                        `Abuse detected for request ${options.method} ${options.url}`
          )
        )
      }
    }
  })
}

// Must include Snyk id to distinguish between issues within the same component, that might have different mitigation
// and/or exploitability
function getIssueTitle (issue) {
  const {
    id,
    pkgName,
    pkgVersions,
    issueData: { title },
    projects
  } = issue
  const projectName = getProjectName(projects)
  return `${projectName} - ${title} in ${pkgName} ${pkgVersions.join(
        '/'
    )} - ${id}`
}

function getIssueBody (issue) {
  const {
    id,
    issueData: { url, description },
    projects
  } = issue
  return `This issue has been created automatically by a source code scanner

## Third party component with known security vulnerabilities

Introduced to ${getProjectName(projects)} through:

${getGraph(issue, '* ')}

${description}
- [${id}](${url})
${getIdentifiers(issue)}`
}

function getIdentifiers (issue) {
  let s = ''
  for (const ids of Object.values(issue.issueData.identifiers)) {
    for (const id of ids) {
      s += `- ${id}\r\n`
    }
  }
  return s
}

const filterUndefined = (x) => !!x
