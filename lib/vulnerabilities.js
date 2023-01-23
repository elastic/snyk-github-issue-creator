'use strict'

const chalk = require('chalk')
const { prompt } = require('enquirer')
const flatten = require('lodash.flatten')
const ora = require('ora')
const { default: PQueue } = require('p-queue')

const { conf } = require('./config')
const github = require('./github')
const Snyk = require('./snyk')
const { compare, uniq } = require('./utils')

module.exports = async () => {
  // Display confirmation when creating issues in public GitHub repo
  let spinner = ora('Loading GitHub repositories').start()
  const repo = await github.client.repos.get({
    owner: conf.ghOwner,
    repo: conf.ghRepo
  })
  spinner.succeed()

  if (!repo.data.private) {
    const response = await prompt({
      type: 'confirm',
      name: 'question',
      message:
                'You are about to create issue(s) related to security vulnerabilities inside a public GitHub repo.' +
                ' Are you sure you want to continue?',
      default: false
    })
    if (!response.question) {
      process.exit(0)
    }
  }

  const snyk = new Snyk({
    token: conf.snykToken,
    orgId: conf.snykOrg,
    minimumSeverity: conf.minimumSeverity
  })

  spinner = ora('Loading Snyk projects').start()
  const projects = await snyk.projects()
  spinner.succeed()

  spinner = ora('Loading Snyk issues').start()
  const queue = new PQueue({ concurrency: 6 }); // `6` seems to give the best performance on a fast internet connection
  const projectIssues = []
  for (const snykProject of conf.snykProjects) {
    const project = projects.find((x) => x.id === snykProject)
    const issues = await snyk.issues(snykProject)

    for (const issue of issues) {
      const page = issue.links.paths

      delete issue.links // no need for this property

      issue.project = project
      issue.paths = []

      queue.add(populateIssueDependencyGraph.bind(null, snyk, issue, page))

      projectIssues.push(issue)
    }
  }

  await queue.onIdle();
  spinner.succeed()

  const issues = flatten(projectIssues).sort(
    (a, b) =>
      b.priority.score - a.priority.score || // descending priority score
            compare.severities(a.issueData.severity, b.issueData.severity) || // descending severity (Critical, then High, then Medium, then Low)
            compare.text(a.pkgName, b.pkgName) || // ascending package name
            compare.versionArrays(a.pkgVersions, b.pkgVersions) || // descending package version
            compare.text(a.issueData.title, b.issueData.title) || // ascending vulnerability title
            compare.text(a.project.name, b.project.name) // ascending project name
  )

  if (issues.length === 0) {
    console.log(chalk.green('No issues to create'))
    process.exit(0)
  }

  // Combine duplicate issues across different projects into a single issue with an array of its `projects` and an array of paths grouped by project (called `from`)
  const reduced = issues.reduce((acc, cur) => {
    const { id, paths, project } = cur
    if (!acc[id]) {
      cur.from = []
      delete cur.paths
      cur.projects = []
      delete cur.project
      acc[id] = cur
    }
    acc[id].from.push({ project, paths })
    acc[id].projects = uniq(acc[id].projects.concat(project))
    return acc
  }, {})

  return Object.values(reduced)
}

async function populateIssueDependencyGraph (snyk, issue, page) {
  // Populate each issue with all dependency paths by crawling the API links
  while (page !== null) {
    const result = await snyk.getLink(page)
    // result.paths example:
    // [
    //     [
    //       { name: 'd3-scale', version: '1.0.7' },
    //       { name: 'd3-color', version: '1.4.1' }
    //     ],
    //     [
    //       { name: 'react-vis', version: '1.8.2' },
    //       { name: 'd3-color', version: '1.4.1' }
    //     ],
    //     [
    //       { name: 'd3-interpolate', version: '3.0.1' },
    //       { name: 'd3-color', version: '3.0.1' }
    //     ],
    //     [
    //       { name: 'd3-scale', version: '1.0.7' },
    //       { name: 'd3-interpolate', version: '1.4.0' },
    //       { name: 'd3-color', version: '1.4.1' }
    //     ]
    // ]
    issue.paths = issue.paths.concat(result.paths)
    page = result.links.next ?? null
  }
}
