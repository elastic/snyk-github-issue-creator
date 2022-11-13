'use strict';

const { prompt } = require('enquirer');

const { conf } = require('../config');
const { capitalize } = require('../utils');
const { getGraph } = require('../github/utils');

module.exports = async (vulnerabilities) => {
    const issueQuestions = [];

    let ctr = 0;
    console.log(`Found ${vulnerabilities.length} vulnerabilities...`);
    console.log(
        `Format: [Severity]|[Priority score] - [Package name] [Package Version] - [Vuln title] - [Vuln ID]\n`
    );
    vulnerabilities.forEach((issue, i) => {
        const {
            id,
            pkgName,
            pkgVersions,
            priorityScore,
            issueData: { title, severity },
        } = issue;
        const severityPrefix = `${capitalize(
            severity[0]
        )}|${priorityScore}`;
        const num = i + 1;
        const description = `${num}. ${severityPrefix} - ${pkgName} ${pkgVersions.join(
            '/'
        )} - ${title} - ${id}`;
        console.log(`${description}\n${getGraph(issue, ' * ', true)}\n`);
        issueQuestions.push({
            type: 'confirm',
            name: `question-${ctr++}`,
            message: conf.batch
                ? `Add "${description}" to batch?`
                : `Create GitHub issue for ${description}?`,
            default: false,
        });
    });

    const issueAnswers = await prompt(issueQuestions);

    return vulnerabilities.filter(
        (_issue, i) => issueAnswers[`question-${i}`]
    );
};
