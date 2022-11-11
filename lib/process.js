'use strict';

const { prompt } = require('enquirer');
const chalk = require('chalk');

const { getBatchProps } = require('./batch');
const { conf } = require('./config');
const github = require('./github');
const { capitalize, getGraph } = require('./utils');

module.exports = async (issues) => {
    let continuePrompting = true;
    while (continuePrompting) {
        let issuesToPromptFor = [...issues];
        if (conf.batch) {
            // filter down to the package that was picked
            issuesToPromptFor = (await getBatchProps(issues)).issues;
        }

        if (conf.autoGenerate) {
            if (conf.batch) {
                console.log(
                    chalk.grey(
                        `Auto-generating a single GitHub issue for ${
                            issuesToPromptFor.length
                        } issue${issuesToPromptFor.length > 1 ? 's' : ''}`
                    )
                );
                await github.createIssues(issuesToPromptFor);
            } else {
                console.log(
                    chalk.grey(
                        `Auto-generating ${
                            issuesToPromptFor.length
                        } GitHub issue${
                            issuesToPromptFor.length > 1 ? 's' : ''
                        }...`
                    )
                );

                // retrieve issue IDs already created in GitHub
                const existingIssues = await getOctokit().paginate(
                    `GET /search/issues?q=repo%3A${conf.ghOwner}/${conf.ghRepo}+is%3Aissue+label%3Asnyk`,
                    (response) =>
                        response.data.map((existingIssue) => [
                            existingIssue.title,
                            existingIssue.number,
                        ])
                );

                await github.createIssues(
                    issuesToPromptFor,
                    new Map(existingIssues)
                );
            }
            return;
        }

        const issueQuestions = [];

        let ctr = 0;
        console.log(`Found ${issuesToPromptFor.length} vulnerabilities...`);
        console.log(
            `Format: [Severity]|[Priority score] - [Package name] [Package Version] - [Vuln title] - [Vuln ID]\n`
        );
        issuesToPromptFor.forEach((issue, i) => {
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

        const issuesToAction = issuesToPromptFor.filter(
            (_issue, i) => issueAnswers[`question-${i}`]
        );

        await github.createIssues(issuesToAction);

        continuePrompting = (
            await prompt({
                type: 'confirm',
                name: 'continuePrompting',
                message: 'Pick another issue?',
            })
        ).continuePrompting;
    }
}
