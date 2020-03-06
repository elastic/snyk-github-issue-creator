#!/usr/bin/env node

const { prompt } = require('enquirer');
const args = require('minimist')(process.argv.slice(2));
const uuidValidate = require('uuid-validate');
const request = require('request-promise-native');
const chalk = require('chalk');

const { getBatchProps } = require('./batch');
const { capitalize, compareText, uniq } = require('./utils');

const snykBaseUrl = 'https://snyk.io/api/v1';
const snykToken = process.env.SNYK_TOKEN;

const ghBaseUrl = 'https://api.github.com';
const ghPat = process.env.GH_PAT;

const help = 'Usage: snyk-github-issue-creator --snykOrg=<snykOrg> --snykProject=<snykProject> ' +
  '--ghOwner=<ghOwner> --ghRepo=<ghRepo> ' +
  '--ghLabels=<ghLabel>,... --projectName=<projectName> --parseManifestName --batch --autoGenerate';

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
const batch = !!args.batch;

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

  const batchProps = batch && await getBatchProps(issues);
  if (batchProps) {
    // filter down to the package that was picked
    issues = batchProps.issues;
  }

  if (autoGenerate) {
    if (batch) {
      console.log(chalk.grey(`Auto-generating a single GitHub issue for ${issues.length} issue${issues.length > 1 ? 's' : ''}`));
    } else {
      console.log(chalk.grey(`Auto-generating GitHub issues for ${issues.length} issue${issues.length > 1 ? 's' : ''}`));
    }
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
      type: 'confirm',
      name: `question-${ctr++}`,
      type: 'confirm',
      message: batch ? `Add ${description} to batch?` : `Create GitHub issue for ${description}?`,
      default: false
    });
  });

  const issueAnswers = await prompt(issueQuestions);

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

async function generateGhIssues(project, issues) {
  const labels = (typeof args.ghLabels !== "undefined") ? args.ghLabels.split(",") : [];

  const projectName = getProjectName(project);
  let ghIssues = [];
  if (batch && issues.length) {
    const sevMap = issues.reduce((acc, cur) => {
      acc[cur.severity] = (acc[cur.severity] || []).concat(cur);
      return acc;
    }, {});
    const severities = Object.keys(sevMap).map(sev => capitalize(sev)).join(`/`);
    const batchProps = await getBatchProps(issues);

    // if there is a single vulnerability, just use that for the description
    let description = `${issues[0].title}`;
    if (issues.length > 1) {
      // otherwise, if there are multiple vulnerabilities:
      const titles = uniq(issues.map(x => x.title));
      const vuln = titles.length === 1 ? ` ${titles[0]}` : '';
      // if there are multiple of vulnerabilities of a single type, include the type in the description
      // otherwise, if there are multiple types of vulnerabilities of a multiple types, leave that out of the description
      description = `${issues.length}${vuln} findings`;
    }
    const title = `${getProjectName(project)} - ${description} in ${batchProps.package} ${batchProps.version} (${severities})`;

    const text = Object.keys(sevMap).map(sev => {
      const header = `# ${capitalize(sev)}-severity vulnerabilities`;
      const body = sevMap[sev].map((issue, i) =>
`\r\n\r\n<details>
<summary>${i + 1}. ${issue.title} in ${issue.package} ${issue.version} (${issue.id})</summary>

## Detailed paths
${getGraph(project, issue, '* ')}

${issue.description}
- [${issue.id}](${issue.url})
</details>`).join('');
      return header + body;
    }).join('\r\n\r\n');

    ghIssues = [await request({
      method: 'post',
      url: `${ghBaseUrl}/repos/${args.ghOwner}/${args.ghRepo}/issues`,
      headers: {
        "User-Agent": `${args.ghOwner} ${args.ghRepo}`,
        authorization: `token ${ghPat}`,
      },
      body: {
        title,
        body: `This issue has been created automatically by a source code scanner.

Snyk project: [\`${project.name}\`](${project.browseUrl}) (manifest version ${project.imageTag})

${text}`,
        labels
      },
      json: true,
    })];
  } else {
    ghIssues = await Promise.all( issues.map(issue => request({
      method: 'post',
      url: `${ghBaseUrl}/repos/${args.ghOwner}/${args.ghRepo}/issues`,
      headers: {
        "User-Agent": `${args.ghOwner} ${args.ghRepo}`,
        authorization: `token ${ghPat}`,
      },
      body: {
        title: `${getProjectName(project)} - ${issue.title} in ${issue.package} ${issue.version}`,
        body: `This issue has been created automatically by a source code scanner

  SNYKUID:${issue.id}

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
  }

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

