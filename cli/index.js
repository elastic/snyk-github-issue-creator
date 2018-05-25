#!/usr/bin/env node

const Enquirer = require('enquirer');
const args = require('minimist')(process.argv.slice(2));
const uuidValidate = require('uuid-validate');
const request = require('request-promise-native');
const markdown2confluence = require('markdown2confluence-cws');
const chalk = require('chalk');

const apiBase = 'https://snyk.io/api/v1';
const apiKey = process.env.SNYK_TOKEN;

const help = 'Usage: snyk-jira-issue-creator --orgId=<orgId> --projectId=<projectId> ' +
  '--jiraProjectId=<jiraProjectId> --jiraIssueTypeId=<jiraIssueTypeId> ' +
  '--jiraUrl=https://<subdomain>.atlassian.net --includeExisting --autoGenerate';

if (args.help || args.h) {
  console.log(help);
  return process.exit(0);
}

const validators = {
  orgId: uuidValidate,
  projectId: uuidValidate,
  jiraProjectId: id => !!id,
  jiraIssueTypeId: id => !!id,
  jiraUrl: id => !!id,
};

const invalidArgs = Object.keys(validators).filter(key =>
  !validators[key](args[key])
);

if (invalidArgs.length > 0) {
  console.log(chalk.red(`Invalid args passed: ${invalidArgs.join(', ')}`));
  console.log(help);
  return process.exit(1);
}

const includeExisting = !!args.includeExisting;
const autoGenerate = !!args.autoGenerate;

console.log(chalk.grey(`Existing Jira issues will ${includeExisting ? '' : 'not '}be included`));

const enquirer = new Enquirer();
enquirer.register('confirm', require('prompt-confirm'));

async function createIssues () {
  const projects = await request({
    method: 'get',
    url: `${apiBase}/org/${args.orgId}/projects`,
    headers: {
      authorization: `token ${apiKey}`,
    },
    json: true,
  });

  const projectIssues = await request({
    method: 'post',
    url: `${apiBase}/org/${args.orgId}/project/${args.projectId}/issues`,
    headers: {
      authorization: `token ${apiKey}`,
    },
    json: true,
  });

  const existingJiraIssues = await request({
    method: 'get',
    url: `${apiBase}/org/${args.orgId}/project/${args.projectId}/jira-issues`,
    headers: {
      authorization: `token ${apiKey}`,
    },
    json: true,
  });

  const project = projects.projects.find(project => project.id === args.projectId);

  const issues = projectIssues.issues.vulnerabilities.concat(projectIssues.issues.licenses).filter(issue => {
    if (!includeExisting && existingJiraIssues[issue.id]) {
      return false;
    }
    return true;
  });

  if (issues.length === 0) {
    console.log(chalk.green('No issues to create'));
    return process.exit(0);
  }

  if (autoGenerate) {
    console.log(chalk.grey(`Auto-generating Jira issues for ${issues.length} issue${issues.length > 1 ? 's' : ''}`));
    await generateJiraIssues(project, issues);
    return process.exit(0);
  }

  const issueQuestions = [];

  issues.forEach(issue => {
    const name = `question-${issue.id}`;
    enquirer.question({
      name,
      type: 'confirm',
      message: `Create Jira issue for "${issue.title}" in ${issue.package} (${issue.id})?`,
      default: false,
    });
    issueQuestions.push(name);
  });

  const issueAnswers = await enquirer.prompt(issueQuestions);

  const issuesToAction = issues.filter(issue => issueAnswers[`question-${issue.id}`]);

  await generateJiraIssues(project, issuesToAction);

  process.exit(0);
}

async function generateJiraIssues (project, issues) {
  const jiraIssues = await Promise.all(issues.map(issue => request({
    method: 'post',
    url: `${apiBase}/org/${args.orgId}/project/${args.projectId}/issue/${issue.id}/jira-issue`,
    headers: {
      authorization: `token ${apiKey}`,
    },
    body: {
      fields: {
        project: {id: args.jiraProjectId},
        issuetype: {id: args.jiraIssueTypeId},
        summary: `${project.name} - ${issue.title} in ${issue.package}`,
        description: markdown2confluence(issue.description),
      },
    },
    json: true,
  })));

  if (jiraIssues.length === 0) {
    return console.log(chalk.green('No Jira issues were created'));
  }

  console.log(chalk.green('The following Jira issues were created:'));
  jiraIssues.forEach(jiraIssueByIssue => {
    Object.keys(jiraIssueByIssue).forEach(issueId => {
      const issue = issues.find(issue => issue.id === issueId);
      console.log(`- "${issue.title}" in ${issue.package} (${issue.id})`);

      jiraIssueByIssue[issueId].forEach(({jiraIssue}) => {
        console.log(`  ${args.jiraUrl}/browse/${jiraIssue.key}`);
      });
    });
  });
}

createIssues()
.catch(err => {
  console.error(err.stack);
  process.exit(1);
})
