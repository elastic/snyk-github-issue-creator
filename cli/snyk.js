'use strict';

const request = require('request-promise-native');

const baseUrl = 'https://snyk.io/api/v1';

module.exports = class Snyk {
    constructor({ token, orgId }) {
        this._headers = {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: token,
        };
        this._orgId = orgId;
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

    async projects(orgId) {
        return (
            await request({
                url: `${baseUrl}/org/${orgId || this._orgId}/projects`,
                headers: this._headers,
                json: true,
            })
        ).projects;
    }

    async issues(projectId) {
        return (
            await request({
                method: 'post',
                url: `${baseUrl}/org/${this._orgId}/project/${projectId}/issues`,
                headers: this._headers,
                body: {
                    filters: {
                        severities: ['high', 'medium'],
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
