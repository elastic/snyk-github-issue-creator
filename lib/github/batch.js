'use strict'

const flatten = require('lodash.flatten')

const getBatchProps = require('../batch')
const { getProjectName, getUniqueProjectNamePrefixes, getGraph } = require('./utils')
const { capitalize, uniq } = require('../utils')

const getProjects = (issues) =>
  uniq(flatten(issues.map((issue) => issue.projects)))

module.exports = async (issues) => {
  const sevMap = issues.reduce((acc, cur) => {
    acc[cur.issueData.severity] = (acc[cur.issueData.severity] || []).concat(cur)
    return acc
  }, {})
  const batchProps = await getBatchProps(issues)

  // if there is a single vulnerability, just use that for the description
  let description = `${issues[0].issueData.title}`
  if (issues.length > 1) {
    // otherwise, if there are multiple vulnerabilities:
    const titles = uniq(issues.map((x) => x.issueData.title))
    const vuln = titles.length === 1 ? ` ${titles[0]}` : ''
    // if there are multiple of vulnerabilities of a single type, include the type in the description
    // otherwise, if there are multiple types of vulnerabilities of a multiple types, leave that out of the description
    description = `${issues.length}${vuln} findings`
  }
  const projects = getProjects(issues)
  const showFullManifest = getUniqueProjectNamePrefixes(projects).size > 1
  const title = `${getProjectName(projects)} - ${description} in ${
        batchProps.pkgName
    } ${batchProps.version}`

  const headerText = 'This issue has been created automatically by [snyk-github-issue-creator](https://github.com/elastic/snyk-github-issue-creator).\r\n\r\nSnyk project(s):'
  const projectText = projects
    .map(
      ({ name, browseUrl, imageTag }) =>
                `\r\n * [\`${name}\`](${browseUrl}) (manifest version ${imageTag})`
    )
    .join('')
  const sectionText = Object.keys(sevMap)
    .map((sev) => {
      const header = `# ${capitalize(sev)}-severity vulnerabilities`
      const body = sevMap[sev]
        .map(
          (issue, i) =>
                        `\r\n\r\n<details>
<summary>${i + 1}. ${issue.issueData.title} in ${
                            issue.pkgName
                        } ${issue.pkgVersions.join('/')} (${[issue.id]
                            .concat(
                                Object.values(
                                    issue.issueData.identifiers
                                ).flat()
                            )
                            .join(', ')})</summary>

## Detailed paths
${getGraph(issue, '* ', showFullManifest)}

${issue.issueData.description}
- [${issue.id}](${issue.issueData.url})
</details>`
        )
        .join('')
      return '\r\n\r\n' + header + body
    })
    .join('')
  const body = headerText + projectText + sectionText

  return { title, body }
}
