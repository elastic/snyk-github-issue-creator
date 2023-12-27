'use strict'

const request = require('request-promise-native')
const { dressError } = require('./utils')

const baseV1Url = 'https://snyk.io/api/v1'
const baseRestUrl = 'https://api.snyk.io/rest'

module.exports = class Snyk {
  constructor ({ token, orgId, minimumSeverity }) {
    this._headers = {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: token
    }
    this._orgId = orgId
    this._minimumSeverity = minimumSeverity
  }

  setOrg (id) {
    this._orgId = id
  }

  async orgs () {
    return (
      await request({
        url: `${baseV1Url}/orgs`,
        headers: this._headers,
        json: true
      })
    ).orgs
  }

  async queryProjectDetails (organizationId, projectId) {
    try {
      return await request({
        method: 'get',
        url: `${baseV1Url}/org/${organizationId}/project/${projectId}`,
        headers: this._headers,
        json: true
      })
    } catch (err) {
      throw new Error(dressError(err, `Failed to query snyk project details. Organization ID: ${organizationId}, Project ID: ${projectId}`))
    }
  }

  async projects (orgId, selectedProjects = []) {
    const organizationId = orgId || this._orgId

    const responseData = await paginateRestResponseData(
      `${baseRestUrl}/orgs/${organizationId}/projects?version=2023-11-27&meta.latest_issue_counts=true&limit=20`,
      this._headers
    )

    const projects = await Promise.all(
      responseData.map(async (project) => {
        const { critical, high, medium, low } = project.meta.latest_issue_counts
        const issueCountTotal = critical + high + medium + low

        const projectDetails = await this.queryProjectDetails(organizationId, project.id)

        return {
          id: project.id,
          name: project.attributes.name,
          isMonitored:
            project.attributes.status === 'active',
          issueCountTotal,
          browseUrl: projectDetails.browseUrl,
          imageTag: projectDetails.imageTag
        }
      })
    )

    return projects.filter(({ id, isMonitored }) => {
      if (selectedProjects.includes(id)) {
        return true
      }
      return isMonitored
    })
  }

  async issues (projectId) {
    return (
      await request({
        method: 'post',
        url: `${baseV1Url}/org/${this._orgId}/project/${projectId}/aggregated-issues`,
        headers: this._headers,
        body: {
          includeDescription: true,
          filters: {
            severities: getSeverities(this._minimumSeverity),
            types: ['vuln'],
            ignored: false,
            patched: false
          }
        },
        json: true
      })
    ).issues
  }

  async getLink (url) {
    return (
      await request({
        method: 'get',
        url,
        headers: this._headers,
        json: true
      })
    )
  }
}

function getSeverities (minimumSeverity) {
  if (minimumSeverity && minimumSeverity.toLowerCase() === 'critical') {
    return ['critical']
  } else if (minimumSeverity && minimumSeverity.toLowerCase() === 'high') {
    return ['critical', 'high']
  } else if (!minimumSeverity || minimumSeverity.toLowerCase() === 'medium') {
    return ['critical', 'high', 'medium']
  }
  return ['critical', 'high', 'medium', 'low']
}

async function paginateRestResponseData (url, headers, method = 'get') {
  try {
    const reponseData = []
    do {
      const response = await request({
        method,
        url,
        headers,
        json: true
      })
      reponseData.push(...response.data)
      if (response.links.next) url = baseRestUrl + response.links.next.trimStart('/rest')
      else url = undefined
    } while (url)

    return reponseData
  } catch (err) {
    throw new Error(dressError(err, `Failed to paginate request for ${method} ${url}`))
  }
}
