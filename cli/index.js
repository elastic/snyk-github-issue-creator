const prompt = require('prompt');
const optimist = require('optimist');
const uuidValidate = require('uuid-validate');
const request = require('request-promise');
const markdown2confluence = require("markdown2confluence-cws");

prompt.start();

prompt.message = '';

prompt.override = optimist.argv

prompt.get({
  properties: {
    orgId: {
      description: 'Enter the org ID',
      message: 'Org ID should be a valid UUID',
      conform: value => uuidValidate(value),
      required: true,
    },
    projectId: {
      description: 'Enter the project ID',
      message: 'Project ID should be a valid UUID',
      conform: value => uuidValidate(value),
      required: true,
    },
    jiraProjectId: {
      description: 'Enter the Jira project ID',
      required: true,
    },
    jiraIssueTypeId: {
      description: 'Enter the Jira issue type ID',
      required: true,
    },
    jiraUrl: {
      description: 'Enter the URL for your Jira install',
      required: true,
      format: 'url',
    }
  },
}, async (err, config) => {
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

  const issuePrompts = issues.map(issue => ({
    name: issue.id,
    description: `Create Jira issue for "${issue.title}" in ${issue.package} (${issue.id})?`,
    type: 'boolean',
    default: false,
  }));

  const issueChoices = await new Promise((resolve, reject) => {
    prompt.get(issuePrompts, async (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });

  const issuesToAction = issues.filter(issue => issueChoices[issue.id]);

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
        description:markdown2confluence(issue.description),
      },
    },
    json: true,
  })));

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
});
