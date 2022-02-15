'use strict';

const { prompt } = require('enquirer');
const flatten = require('lodash.flatten');

const {
    capitalize,
    compare,
    uniq,
    getProjectName,
    getUniqueProjectNamePrefixes,
    getGraph,
} = require('./utils');

// Longest possible severity string. Each vulnerability in the prompt has a
// severity label that is padded out to this many characters
const SEVERITY_PREFIX_PADDING = 'M|1000'.length;

const getBatchProps = async (issues) => {
    const pkgNames = uniq(issues.map((x) => x.pkgName));

    if (pkgNames.length === 1) {
        return {
            pkgName: pkgNames[0],
            version: getBatchVersionString(issues),
            issues,
        };
    }

    const reduced = issues.reduce((acc, cur) => {
        const { pkgName } = cur;
        if (!acc[pkgName]) {
            acc[pkgName] = [];
        }
        acc[pkgName].push(cur);
        return acc;
    }, {});
    const choices = Object.entries(reduced).map(([pkgName, issues]) => {
        const severity = getBatchSeverityString(issues);
        const version = getBatchVersionString(issues);
        return `${severity} - ${pkgName} ${version}`;
    });

    const { selected } = await prompt({
        type: 'select',
        name: 'selected',
        message: 'Pick a vulnerable package',
        choices,
    });

    const trimmed = selected.slice(SEVERITY_PREFIX_PADDING + ' - '.length); // remove the severity prefix
    const pkgName = trimmed.substring(0, trimmed.indexOf(' '));
    const version = trimmed.substring(trimmed.indexOf(' ') + 1);
    const _issues = issues.filter((issue) => issue.pkgName === pkgName);
    return {
        pkgName,
        version,
        issues: _issues,
    };
};

const getBatchSeverityString = (issues) => {
    // assume that the issues are already sorted in descending order of priority score
    const severity = capitalize(issues[0].issueData.severity[0]); // only use the severity level of the highest-scored issue
    const score = issues[0].priorityScore; // only use the priority score of the highest-scored issue
    const severityText = `${severity}|${score}`;
    const padding = ' '
        .repeat(SEVERITY_PREFIX_PADDING)
        .slice(severityText.length);
    return `${severityText}${padding}`;
};

const getBatchVersionString = (issues) =>
    uniq(flatten(issues.map((x) => x.pkgVersions))).sort(compare.versions).join('/');

const getProjects = (issues) =>
    uniq(flatten(issues.map((issue) => issue.projects)));

const getBatchIssue = async (issues) => {
    const sevMap = issues.reduce((acc, cur) => {
        acc[cur.issueData.severity] = (acc[cur.issueData.severity] || []).concat(cur);
        return acc;
    }, {});
    const batchProps = await getBatchProps(issues);

    // if there is a single vulnerability, just use that for the description
    let description = `${issues[0].issueData.title}`;
    if (issues.length > 1) {
        // otherwise, if there are multiple vulnerabilities:
        const titles = uniq(issues.map((x) => x.issueData.title));
        const vuln = titles.length === 1 ? ` ${titles[0]}` : '';
        // if there are multiple of vulnerabilities of a single type, include the type in the description
        // otherwise, if there are multiple types of vulnerabilities of a multiple types, leave that out of the description
        description = `${issues.length}${vuln} findings`;
    }
    const projects = getProjects(issues);
    const showFullManifest = getUniqueProjectNamePrefixes(projects).size > 1;
    const title = `${getProjectName(projects)} - ${description} in ${
        batchProps.pkgName
    } ${batchProps.version}`;

    const headerText = `This issue has been created automatically by a source code scanner.\r\n\r\nSnyk project(s):`;
    const projectText = projects
        .map(
            ({ name, browseUrl, imageTag }) =>
                `\r\n * [\`${name}\`](${browseUrl}) (manifest version ${imageTag})`
        )
        .join('');
    const sectionText = Object.keys(sevMap)
        .map((sev) => {
            const header = `# ${capitalize(sev)}-severity vulnerabilities`;
            const body = sevMap[sev]
                .map(
                    (issue, i) =>
                        `\r\n\r\n<details>
<summary>${i + 1}. ${issue.issueData.title} in ${issue.pkgName} ${issue.pkgVersions.join('/')} (${
                            issue.id
                        })</summary>

## Detailed paths
${getGraph(issue, '* ', showFullManifest)}

${issue.description}
- [${issue.id}](${issue.url})
</details>`
                )
                .join('');
            return '\r\n\r\n' + header + body;
        })
        .join('');
    const body = headerText + projectText + sectionText;

    return { title, body };
};

module.exports = {
    getBatchProps,
    getBatchVersion: getBatchVersionString,
    getBatchIssue,
};
