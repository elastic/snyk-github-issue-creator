#!/usr/bin/env node

const Enquirer = require('enquirer');
const args = require('minimist')(process.argv.slice(2));
const uuidValidate = require('uuid-validate');
const request = require('request-promise-native');
const markdown2confluence = require('markdown2confluence-cws');

const help = 'Usage: snyk-jira-issue-creator --orgId=<orgId> --projectId=<projectId> ' +
  '--jiraProjectId=<jiraProjectId> --jiraIssueTypeId=<jiraIssueTypeId> ' +
  '--jiraUrl=https://<subdomain>.atlassian.net';

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
  console.log(`Invalid args passed: ${invalidArgs.join(', ')}`);
  console.log(help);
  return process.exit(1);
}

const enquirer = new Enquirer();
enquirer.register('confirm', require('prompt-confirm'));

async function createIssues (config) {
  const apiBase = 'https://snyk.io/api/v1';
  const apiKey = process.env.SNYK_TOKEN;

  const projects = await request({
    method: 'get',
    url: `${apiBase}/org/${config.orgId}/projects`,
    headers: {
      authorization: `token ${apiKey}`,
    },
    json: true,
  });

  const projectIssues = await request({
    method: 'post',
    url: `${apiBase}/org/${config.orgId}/project/${config.projectId}/issues`,
    headers: {
      authorization: `token ${apiKey}`,
    },
    json: true,
  });

  const project = projects.projects.find(project => project.id === config.projectId);

  const issues = projectIssues.issues.vulnerabilities.concat(projectIssues.issues.licenses);

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

  const jiraIssues = await Promise.all(issuesToAction.map(issue => request({
    method: 'post',
    url: `${apiBase}/org/${config.orgId}/project/${config.projectId}/issue/${issue.id}/jira-issue`,
    headers: {
      authorization: `token ${apiKey}`,
    },
    body: {
      fields: {
        project: {id: config.jiraProjectId},
        issuetype: {id: config.jiraIssueTypeId},
        summary: `${project.name} - ${issue.title} in ${issue.package}`,
        description: markdown2confluence(issue.description),
      },
    },
    json: true,
  })));

  if (jiraIssues.length === 0) {
    console.log('No Jira issues were created');
    return process.exit(0);
  }

  console.log('The following Jira issues were created:');
  jiraIssues.forEach(jiraIssueByIssue => {
    Object.keys(jiraIssueByIssue).forEach(issueId => {
      const issue = issues.find(issue => issue.id === issueId);
      console.log(`"${issue.title}" in ${issue.package} (${issue.id})`);

      jiraIssueByIssue[issueId].forEach(({jiraIssue}) => {
        console.log(`${config.jiraUrl}/browse/${jiraIssue.key}`);
      });
    });
  });

  process.exit(0);
}

createIssues(args)
.catch(err => {
  console.error(err.stack);
  process.exit(1);
})
