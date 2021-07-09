'use strict';

const request = require('request-promise-native');

const baseUrl = 'https://snyk.io/api/v1';

module.exports = class Snyk {
    constructor({ token, orgId, minimumSeverity }) {
        this._headers = {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: token,
        };
        this._orgId = orgId;
        this._minimumSeverity = minimumSeverity;
    }

    setOrg(id) {
        this._orgId = id;
    }

    async orgs() {
        return (
            await request({
                url: `${baseUrl}/orgs`,
                headers: this._headers,
                json: true,
            })
        ).orgs;
    }

    async projects(orgId, selectedProjects = []) {
        const { projects } = await request({
            url: `${baseUrl}/org/${orgId || this._orgId}/projects`,
            headers: this._headers,
            json: true,
        });
        return projects
            .map((project) => {
                const { issueCountsBySeverity } = project;
                const { critical, high, medium, low } = issueCountsBySeverity;
                const issueCountTotal = critical + high + medium + low;
                return { ...project, issueCountTotal };
            })
            .filter(({ id, isMonitored, issueCountTotal }) => {
                if (selectedProjects.includes(id)) {
                    return true;
                }
                return isMonitored;
            });
    }

    async issues(projectId) {
        return (
            await request({
                method: 'post',
                url: `${baseUrl}/org/${this._orgId}/project/${projectId}/issues`,
                headers: this._headers,
                body: {
                    filters: {
                        severities: getSeverities(this._minimumSeverity),
                        types: ['vuln'],
                        ignored: false,
                        patched: false,
                    },
                },
                json: true,
            })
        ).issues;
    }
};

function getSeverities(minimumSeverity) {
    if (minimumSeverity && minimumSeverity.toLowerCase() === 'critical') {
        return ['critical'];
    } else if (minimumSeverity && minimumSeverity.toLowerCase() === 'high') {
        return ['critical', 'high'];
    } else if (!minimumSeverity || minimumSeverity.toLowerCase() === 'medium') {
        return ['critical', 'high', 'medium'];
    }
    return ['critical', 'high', 'medium', 'low'];
}
