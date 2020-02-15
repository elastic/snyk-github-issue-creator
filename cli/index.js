#!/usr/bin/env node

const Enquirer = require('enquirer');
const args = require('minimist')(process.argv.slice(2));
const uuidValidate = require('uuid-validate');
const request = require('request-promise-native');
const chalk = require('chalk');

const { compareText } = require('./utils');

const snykBaseUrl = 'https://snyk.io/api/v1';
const snykToken = process.env.SNYK_TOKEN;

const ghBaseUrl = 'https://api.github.com';
const ghPat = process.env.GH_PAT;

const help = 'Usage: snyk-github-issue-creator --snykOrg=<snykOrg> --snykProject=<snykProject> ' +
  '--ghOwner=<ghOwner> --ghRepo=<ghRepo> ' +
  '--ghLabels=<ghLabel>,... --projectName=<projectName> --parseManifestName --autoGenerate';

if (args.help || args.h) {
  console.log(help);
  return process.exit(0);
}

const validators = {
  snykOrg: id => !!id,
  snykProject: uuidValidate,
  ghOwner: id => !!id,
  ghRepo: id => !!id,
};

const invalidArgs = Object.keys(validators).filter(key =>
  !validators[key](args[key])
);

if (invalidArgs.length > 0) {
  console.log(chalk.red(`Invalid args passed: ${invalidArgs.join(', ')}`));
  console.log(help);
  return process.exit(1);
}

const autoGenerate = !!args.autoGenerate;

const enquirer = new Enquirer();
enquirer.register('confirm', require('prompt-confirm'));

async function createIssues () {

	
  const projects = await request({
    method: 'get',
    url: `${snykBaseUrl}/org/${args.snykOrg}/projects`,
    headers: {
      authorization: `token ${snykToken}`,
    },
    json: true,
  });

  const projectIssues = await request({
    method: 'post',
    url: `${snykBaseUrl}/org/${args.snykOrg}/project/${args.snykProject}/issues`,
    headers: {
      authorization: `token ${snykToken}`,
    },
    body: {
	filters: {
		"severities": ["high", "medium"], 
		"types": ["vuln"], 
		"ignored":false, 
		"patched":false
	}
    },
    json: true,
  });

  const project = projects.projects.find(project => project.id === args.snykProject);

  // sort issues in descending order of severity, then ascending order of title
  let issues = projectIssues.issues.vulnerabilities.sort((a, b) => compareText(a.severity, b.severity) || compareText(a.title, b.title));

  if (issues.length === 0) {
    console.log(chalk.green('No issues to create'));
    return process.exit(0);
  }

  // combine separate issues that have the same ID with different dependency paths
  const reduced = issues.reduce((acc, cur) => {
    let found = acc[cur.id];
    if (found) {
      found.from.push(cur.from);
    } else {
      cur.from = [cur.from]; // wrap this issue's "from" in an array
      acc[cur.id] = cur;
    }
    return acc;
  }, {});
  issues = Object.values(reduced);

  if (autoGenerate) {
    console.log(chalk.grey(`Auto-generating GitHub issues for ${issues.length} issue${issues.length > 1 ? 's' : ''}`));
    await generateGhIssues(project, issues);
    return process.exit(0);
  }

  const issueQuestions = [];

  let ctr = 0;
  console.log(`Found ${issues.length} vulnerabilities:
`);
  issues.forEach((issue, i) => {
    const description = `${i+1}. ${issue.package} ${issue.version} - ${issue.title}`
    console.log(`${description} - ${issue.id} (${issue.severity})
${getGraph(project, issue, ' * ')}
`);
    issueQuestions.push({
      name: `question-${ctr++}`,
      type: 'confirm',
      message: `Create GitHub issue for ${description}?`,
      default: false
    });
  });

  const issueAnswers = await enquirer.ask(issueQuestions);

  const issuesToAction = issues.filter((_issue, i) => issueAnswers[`question-${i}`]);

  await generateGhIssues(project, issuesToAction);

  process.exit(0);
}

function getProjectName(project) {
  return ((typeof args.projectName !== 'undefined') ?  args.projectName: project.name); 
}

function getManifestName(project) {
  if (args.parseManifestName) {
    return project.name.substring(project.name.indexOf(":") + 1);
  }
  return getProjectName(project);
}

function getGraph(project, issue, prefix) {
  return issue.from.map(paths => `${prefix}${getManifestName(project)} > ${paths.join(' > ')}`).join('\r\n');
}

async function generateGhIssues (project, issues) {
  const labels = (typeof args.ghLabels !== "undefined") ? args.ghLabels.split(",") : [];

  const projectName = getProjectName(project);
  const ghIssues = await Promise.all( issues.map(issue => request({
    method: 'post',
    url: `${ghBaseUrl}/repos/${args.ghOwner}/${args.ghRepo}/issues`,
    headers: {
      "User-Agent": `${args.ghOwner} ${args.ghRepo}`,
      authorization: `token ${ghPat}`,
    },
    body: {
	    title: `${projectName} - ${issue.title} in ${issue.package} ${issue.version}`,
      body: `This issue has been created automatically by a source code scanner

## Third party component with known security vulnerabilities

Introduced to ${projectName} through:

${getGraph(project, issue, '* ')}

${issue.description}
- [${issue.id}](${issue.url})
`,
      labels
    },
    json: true,
  })));

  if (ghIssues.length === 0) {
    return console.log(chalk.green('No GitHub issues were created'));
  }

  console.log(chalk.green('The following GitHub issues were created:'));
  ghIssues.forEach(ghIssue => {
    console.log(`- "${ghIssue.title}" ${ghIssue.url.replace('api.github.com/repos', 'github.com')}`);
  });
}

createIssues()
.catch(err => {
  console.error(err.stack);
  process.exit(1);
})

