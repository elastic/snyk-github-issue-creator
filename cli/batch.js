const { prompt } = require('enquirer');

const { uniq } = require('./utils');

const getBatchProps = async (issues) => {
  const packageNames = uniq(issues.map(x => x.package));

  if (packageNames.length === 1) {
    return {
      package: packageNames[0],
      version: getBatchVersion(issues),
      issues
    }
  }

  const reduced = issues.reduce((acc, cur) => {
    const existing = acc[cur.package];
    if (existing) {
      acc[cur.package] = existing !== cur.version ? '(multiple versions)' : cur.version
    } else {
      acc[cur.package] = cur.version;
    }
    return acc;
  }, {});
  const choices = Object.entries(reduced).map(([package, version]) => `${package} ${version}`);

  const { selected } = await prompt({
    type: 'select',
    name: 'selected',
    message: 'Pick a vulnerable package',
    choices
  });

  const package = selected.substring(0, selected.indexOf(" "));
  const version = selected.substring(selected.indexOf(" ") + 1);
  const _issues = issues.filter(issue => issue.package === package);
  return {
    package,
    version,
    issues: _issues
  }
};

const getBatchVersion = (issues) => {
  const versions = uniq(issues.map(x => x.version))
  return versions.length > 1 ? '(multiple versions)' : versions[0];
};

module.exports = {
  getBatchProps,
  getBatchVersion,
};
