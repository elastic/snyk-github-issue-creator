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

const SEVERITY_PREFIX_PADDING = 16; // each vulnerability in the prompt has a severity label that is padded out to this many characters

const getBatchProps = async (issues) => {
    const packageNames = uniq(issues.map((x) => x.package));

    if (packageNames.length === 1) {
        return {
            packageName: packageNames[0],
            version: getBatchVersionString(issues),
            issues,
        };
    }

    const reduced = issues.reduce((acc, cur) => {
        const packageName = cur.package;
        if (!acc[packageName]) {
            acc[packageName] = [];
        }
        acc[packageName].push(cur);
        return acc;
    }, {});
    const choices = Object.entries(reduced).map(([packageName, issues]) => {
        const severity = getBatchSeverityString(issues);
        const version = getBatchVersionString(issues);
        return `${severity} ${packageName} ${version}`;
    });

    const { selected } = await prompt({
        type: 'select',
        name: 'selected',
        message: 'Pick a vulnerable package',
        choices,
    });

    const trimmed = selected.slice(SEVERITY_PREFIX_PADDING + 1); // remove the severity prefix
    const packageName = trimmed.substring(0, trimmed.indexOf(' '));
    const version = trimmed.substring(trimmed.indexOf(' ') + 1);
    const _issues = issues.filter((issue) => issue.package === packageName);
    return {
        packageName,
        version,
        issues: _issues,
    };
};

const getBatchSeverityString = (issues) => {
    const severities = uniq(issues.map((x) => x.severity)).sort(
        compare.severities
    );
    const severityText = `${capitalize(severities[0])} severity:`; // only use the highest severity level (High, Medium, or Low)
    const padding = ' '
        .repeat(SEVERITY_PREFIX_PADDING)
        .slice(severityText.length);
    return `${severityText}${padding}`;
};

const getBatchVersionString = (issues) => {
    const versions = uniq(issues.map((x) => x.version)).sort(compare.versions);
    return versions.join('/');
};

const getProjects = (issues) => {
    return uniq(flatten(issues.map((issue) => issue.projects)));
};

const getBatchIssue = async (issues) => {
    const sevMap = issues.reduce((acc, cur) => {
        acc[cur.severity] = (acc[cur.severity] || []).concat(cur);
        return acc;
    }, {});
    const batchProps = await getBatchProps(issues);

    // if there is a single vulnerability, just use that for the description
    let description = `${issues[0].title}`;
    if (issues.length > 1) {
        // otherwise, if there are multiple vulnerabilities:
        const titles = uniq(issues.map((x) => x.title));
        const vuln = titles.length === 1 ? ` ${titles[0]}` : '';
        // if there are multiple of vulnerabilities of a single type, include the type in the description
        // otherwise, if there are multiple types of vulnerabilities of a multiple types, leave that out of the description
        description = `${issues.length}${vuln} findings`;
    }
    const projects = getProjects(issues);
    const showFullManifest = getUniqueProjectNamePrefixes(projects).size > 1;
    const title = `${getProjectName(projects)} - ${description} in ${
        batchProps.packageName
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
<summary>${i + 1}. ${issue.title} in ${issue.package} ${issue.version} (${
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
