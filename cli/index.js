#!/usr/bin/env node
'use strict';

const args = require('minimist')(process.argv.slice(2));
const { Octokit } = require('@octokit/rest');
const { throttling } = require('@octokit/plugin-throttling');
const { prompt } = require('enquirer');
const chalk = require('chalk');
const flatten = require('lodash.flatten');
const ora = require('ora');

const { getBatchProps, getBatchIssue } = require('./batch');
const { init: initConfig, conf } = require('./config');
const { getLabels, ensureLabelsAreCreated } = require('./labels');
const {
    capitalize,
    compare,
    getProjectName,
    getGraph,
    uniq,
} = require('./utils');
const Snyk = require('./snyk');

let octokit;

(async () => {
    await initConfig(args);

    const ThrottledOctokit = Octokit.plugin(throttling);
    octokit = new ThrottledOctokit({
        auth: conf.ghPat,
        userAgent: `${conf.ghOwner} ${conf.ghRepo}`,
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

    await createIssues();
})().catch((err) => {
    console.error(chalk.red(err ? err.stack : 'Aborted!'));
    process.exit(1);
});

async function createIssues() {
    // Display confirmation when creating issues in public GitHub repo
    let spinner = ora('Loading GitHub repositories').start();
    const repo = await octokit.repos.get({
        owner: conf.ghOwner,
        repo: conf.ghRepo,
    });
    spinner.succeed();

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

    const snyk = new Snyk({
        token: conf.snykToken,
        orgId: conf.snykOrg,
        minimumSeverity: conf.minimumSeverity,
    });

    spinner = ora('Loading Snyk projects').start();
    const projects = await snyk.projects();
    spinner.succeed();

    spinner = ora('Loading Snyk issues').start();
    const projectIssues = [];
    for (const snykProject of conf.snykProjects) {
        const project = projects.find((x) => x.id === snykProject);
        const issues = await snyk.issues(snykProject);

        for (const issue of issues) {
            let page = issue.links.paths;

            delete issue.links; // no need for this property

            issue.project = project;
            issue.paths = [];

            // Populate each issue with all dependency paths by crawling the API links
            while (page !== null) {
                const result = await snyk.getLink(page);
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
                issue.paths = issue.paths.concat(result.paths);
                page = result.links.next ?? null;
            }

            projectIssues.push(issue);
        }
    }
    spinner.succeed();

    let issues = flatten(projectIssues).sort(
        (a, b) =>
            b.priority.score - a.priority.score || // descending priority score
            compare.severities(a.issueData.severity, b.issueData.severity) || // descending severity (Critical, then High, then Medium, then Low)
            compare.text(a.pkgName, b.pkgName) || // ascending package name
            compare.versionArrays(a.pkgVersions, b.pkgVersions) || // descending package version
            compare.text(a.issueData.title, b.issueData.title) || // ascending vulnerability title
            compare.text(a.project.name, b.project.name) // ascending project name
    );

    if (issues.length === 0) {
        console.log(chalk.green('No issues to create'));
        process.exit(0);
    }

    // Combine duplicate issues across different projects into a single issue with an array of its `projects` and an array of paths grouped by project (called `from`)
    const reduced = issues.reduce((acc, cur) => {
        const { id, paths, project } = cur;
        if (!acc[id]) {
            cur.from = [];
            delete cur.paths;
            cur.projects = [];
            delete cur.project;
            acc[id] = cur;
        }
        acc[id].from.push({ project, paths });
        acc[id].projects = uniq(acc[id].projects.concat(project));
        return acc;
    }, {});
    issues = Object.values(reduced);

    if (conf.batch) {
        // filter down to the package that was picked
        issues = (await getBatchProps(issues)).issues;
    }

    if (conf.autoGenerate) {
        if (conf.batch) {
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
                `GET /search/issues?q=repo%3A${conf.ghOwner}/${conf.ghRepo}+is%3Aissue+label%3Asnyk`,
                (response) =>
                    response.data.map((existingIssue) => [
                        existingIssue.title,
                        existingIssue.number,
                    ])
            );

            await generateGhIssues(issues, new Map(existingIssues));
        }
        process.exit(0);
    }

    const issueQuestions = [];

    let ctr = 0;
    console.log(`Found ${issues.length} vulnerabilities...`);
    console.log(
        `Format: [Severity]|[Priority score] - [Package name] [Package Version] - [Vuln title] - [Vuln ID]\n`
    );
    issues.forEach((issue, i) => {
        const {
            id,
            pkgName,
            pkgVersions,
            priorityScore,
            issueData: { title, severity },
        } = issue;
        const severityPrefix = `${capitalize(severity[0])}|${priorityScore}`;
        const num = i + 1;
        const description = `${num}. ${severityPrefix} - ${pkgName} ${pkgVersions.join('/')} - ${title} - ${id}`;
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

    const issuesToAction = issues.filter(
        (_issue, i) => issueAnswers[`question-${i}`]
    );

    await generateGhIssues(issuesToAction);

    process.exit(0);
}

// Must include Snyk id to distinguish between issues within the same component, that might have different mitigation
// and/or exploitability
function getIssueTitle(issue) {
    const { id, pkgName, pkgVersions, issueData: { title }, projects } = issue;
    const projectName = getProjectName(projects);
    return `${projectName} - ${title} in ${pkgName} ${pkgVersions.join('/')} - ${id}`;
}

function getIssueBody(issue) {
    const { id, issueData: { url, description }, projects } = issue;
    return `This issue has been created automatically by a source code scanner

## Third party component with known security vulnerabilities

Introduced to ${getProjectName(projects)} through:

${getGraph(issue, '* ')}

${description}
- [${id}](${url})
${getIdentifiers(issue)}`;
}

function getIdentifiers(issue) {
    let s = '';
    for (const ids of Object.values(issue.issueData.identifiers)) {
        for (const id of ids) {
            s += `- ${id}\r\n`;
        }
    }
    return s;
}

async function generateGhIssues(issues, existingMap = new Map()) {
    await ensureLabelsAreCreated(octokit, conf.ghOwner, conf.ghRepo, issues);

    let ghNewIssues = [];
    let ghUpdatedIssues = [];
    if (conf.batch && issues.length) {
        const { title, body } = await getBatchIssue(issues);

        ghNewIssues = [
            await octokit.issues.create({
                owner: conf.ghOwner,
                repo: conf.ghRepo,
                title,
                body,
                labels: getLabels(issues),
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
                    owner: conf.ghOwner,
                    repo: conf.ghRepo,
                    title: getIssueTitle(issue),
                    body: getIssueBody(issue),
                    labels: getLabels(issue),
                })
            )
        );

        ghUpdatedIssues = await Promise.all(
            updateIssues.map((issue) =>
                octokit.issues.update({
                    owner: conf.ghOwner,
                    repo: conf.ghRepo,
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
