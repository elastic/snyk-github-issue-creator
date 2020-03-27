#!/usr/bin/env node

const { Octokit } = require('@octokit/rest');
const { throttling } = require('@octokit/plugin-throttling');
const { prompt } = require('enquirer');
const args = require('minimist')(process.argv.slice(2));
const request = require('request-promise-native');
const chalk = require('chalk');
const flatten = require('lodash.flatten');

const { getBatchProps, getBatchIssue } = require('./batch');
const parseAndValidateInput = require('./input');
const { compare, getProjectName, getGraph, uniq } = require('./utils');

const snykBaseUrl = 'https://snyk.io/api/v1';

const {
    snykToken,
    ghPat,
    ghOwner,
    ghRepo,
    snykOrg,
    snykProjects,
} = parseAndValidateInput(args);
const autoGenerate = !!args.autoGenerate;
const batch = !!args.batch;

const ThrottledOctokit = Octokit.plugin(throttling);
const octokit = new ThrottledOctokit({
    auth: ghPat,
    userAgent: `${ghOwner} ${ghRepo}`,
    throttle: {
        onRateLimit: (retryAfter, options) => {
            console.warn(
                chalk.yellow(
                    `Request quota exhausted for request ${options.method} ${options.url}`
                )
            );

            if (options.request.retryCount === 0) {
                // only retries once
                console.log(`Retrying after ${retryAfter} seconds!`);
                return true;
            }
        },
        onAbuseLimit: (retryAfter, options) => {
            // does not retry, only logs a warning
            console.warn(
                chalk.yellow(
                    `Abuse detected for request ${options.method} ${options.url}`
                )
            );
        },
    },
});

async function createIssues() {
    // Display confirmation when creating issues in public GitHub repo
    const repo = await octokit.repos.get({
        owner: ghOwner,
        repo: ghRepo,
    });
    if (!repo.data.private) {
        const response = await prompt({
            type: 'confirm',
            name: 'question',
            message:
                'You are about to create issue(s) related to security vulnerabilities inside a public GitHub repo.' +
                ' Are you sure you want to continue?',
            default: false,
        });
        if (!response.question) {
            process.exit(0);
        }
    }

    const projects = await request({
        method: 'get',
        url: `${snykBaseUrl}/org/${snykOrg}/projects`,
        headers: {
            authorization: `token ${snykToken}`,
        },
        json: true,
    });

    const projectIssues = await Promise.all(
        snykProjects.map((snykProject) =>
            request({
                method: 'post',
                url: `${snykBaseUrl}/org/${snykOrg}/project/${snykProject}/issues`,
                headers: {
                    authorization: `token ${snykToken}`,
                },
                body: {
                    filters: {
                        severities: ['high', 'medium'],
                        types: ['vuln'],
                        ignored: false,
                        patched: false,
                    },
                },
                json: true,
            }).then((response) => {
                // only return vulnerabilities; add the project to each vulnerability object
                const project = projects.projects.find(
                    (x) => x.id === snykProject
                );
                return response.issues.vulnerabilities.map((x) => ({
                    ...x,
                    project,
                }));
            })
        )
    );

    let issues = flatten(projectIssues).sort(
        (a, b) =>
            compare.text(a.severity, b.severity) || // descending severity (High, then Medium)
            compare.text(a.package, b.package) || // ascending package name
            compare.versions(a.version, b.version) || // descending package version
            compare.text(a.title, b.title) || // ascending vulnerability title
            compare.text(a.project.name, b.project.name) || // ascending project name
            compare.arrays(a.from, b.from) // ascending paths
    );

    if (issues.length === 0) {
        console.log(chalk.green('No issues to create'));
        return process.exit(0);
    }

    // create required Github issue labels if needed
    const resp = await octokit.issues
        .getLabel({
            owner: ghOwner,
            repo: ghRepo,
            name: 'snyk',
        })
        .catch(async function (err) {
            if (err.status === 404) {
                await octokit.issues.createLabel({
                    owner: ghOwner,
                    repo: ghRepo,
                    name: 'snyk',
                    description: 'Issue reported by Snyk Open Source scanner',
                    color: '70389f',
                });
            }
        });

    const reduced = issues.reduce((acc, cur) => {
        const { id, from: paths, project, version } = cur;
        const key = `${id}/${version}`;
        if (!acc[key]) {
            cur.from = [];
            cur.projects = [];
            delete cur.project;
            acc[key] = cur;
        }
        acc[key].from.push({ project, paths });
        acc[key].projects = uniq(acc[key].projects.concat([project]));
        return acc;
    }, {});
    issues = Object.values(reduced);

    const batchProps = batch && (await getBatchProps(issues));
    if (batchProps) {
        // filter down to the package that was picked
        issues = batchProps.issues;
    }

    if (autoGenerate) {
        if (batch) {
            console.log(
                chalk.grey(
                    `Auto-generating a single GitHub issue for ${
                        issues.length
                    } issue${issues.length > 1 ? 's' : ''}`
                )
            );
            await generateGhIssues(issues);
        } else {
            console.log(
                chalk.grey(
                    `Auto-generating ${issues.length} GitHub issue${
                        issues.length > 1 ? 's' : ''
                    }...`
                )
            );

            // retrieve issue IDs already created in GitHub
            const existingIssues = await octokit.paginate(
                `GET /search/issues?q=repo%3A${ghOwner}/${ghRepo}+is%3Aissue+label%3Asnyk`,
                (response) =>
                    response.data.map((existingIssue) => [
                        existingIssue.title,
                        existingIssue.number,
                    ])
            );

            await generateGhIssues(issues, new Map(existingIssues));
        }
        return process.exit(0);
    }

    const issueQuestions = [];

    let ctr = 0;
    console.log(`Found ${issues.length} vulnerabilities:\n`);
    issues.forEach((issue, i) => {
        const description = `${i + 1}. ${issue.package} ${issue.version} - ${
            issue.title
        }`;
        console.log(`${description} - ${issue.id} (${issue.severity})
${getGraph(issue, ' * ')}
`);
        issueQuestions.push({
            type: 'confirm',
            name: `question-${ctr++}`,
            message: batch
                ? `Add ${description} to batch?`
                : `Create GitHub issue for ${description}?`,
            default: false,
        });
    });

    const issueAnswers = await prompt(issueQuestions);

    const issuesToAction = issues.filter(
        (_issue, i) => issueAnswers[`question-${i}`]
    );

    await generateGhIssues(issuesToAction);

    process.exit(0);
}

// Must include Snyk id to distinguish between issues within the same component, that might have different mitigation
// and/or exploitability
function getIssueTitle(issue) {
    const { projects, title, package, version, id } = issue;
    const projectName = getProjectName(projects);
    return `${projectName} - ${title} in ${package} ${version} - ${id}`;
}

function getIssueBody(issue) {
    const { projects, description, id, url } = issue;
    return `This issue has been created automatically by a source code scanner

## Third party component with known security vulnerabilities

Introduced to ${getProjectName(projects)} through:

${getGraph(issue, '* ')}

${description}
- [SNYKUID:${id}](${url})
`;
}

async function generateGhIssues(issues, existingMap = new Map()) {
    const labels =
        typeof args.ghLabels !== 'undefined' ? args.ghLabels.split(',') : [];
    labels.push('snyk');

    let ghNewIssues = [];
    let ghUpdatedIssues = [];
    if (batch && issues.length) {
        const { title, body } = await getBatchIssue(issues);

        ghNewIssues = [
            await octokit.issues.create({
                owner: ghOwner,
                repo: ghRepo,
                title,
                body,
                labels,
            }),
        ];
    } else {
        const newIssues = issues.filter(
            (issue) => !existingMap.has(getIssueTitle(issue))
        );
        const updateIssues = issues.filter((issue) =>
            existingMap.has(getIssueTitle(issue))
        );

        ghNewIssues = await Promise.all(
            newIssues.map((issue) =>
                octokit.issues.create({
                    owner: ghOwner,
                    repo: ghRepo,
                    title: getIssueTitle(issue),
                    body: getIssueBody(issue),
                    labels,
                })
            )
        );

        ghUpdatedIssues = await Promise.all(
            updateIssues.map((issue) =>
                octokit.issues.update({
                    owner: ghOwner,
                    repo: ghRepo,
                    issue_number: existingMap.get(getIssueTitle(issue)),
                    body: getIssueBody(issue),
                })
            )
        );
    }

    if (ghNewIssues.length === 0 && ghUpdatedIssues.length === 0) {
        console.log(chalk.green('No GitHub issues were created/updated'));
    } else {
        if (ghUpdatedIssues.length !== 0) {
            console.log(
                chalk.green('The following GitHub issues were updated:')
            );
            ghUpdatedIssues.forEach((ghIssue) => {
                console.log(
                    `- "${ghIssue.data.title}" ${ghIssue.data.url.replace(
                        'api.github.com/repos',
                        'github.com'
                    )}`
                );
            });
        }

        if (ghNewIssues.length !== 0) {
            console.log(
                chalk.green('The following GitHub issues were created:')
            );
            ghNewIssues.forEach((ghIssue) => {
                console.log(
                    `- "${ghIssue.data.title}" ${ghIssue.data.url.replace(
                        'api.github.com/repos',
                        'github.com'
                    )}`
                );
            });
        }
    }
}

createIssues().catch((err) => {
    console.error(chalk.red(err.stack));
    process.exit(1);
});
