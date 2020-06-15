const args = require('minimist')(process.argv.slice(2));
const semver = require('semver');

// ascending order
const compareText = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());

// descending order
const compareVersions = (a, b) =>
    semver.lt(a, b) ? 1 : semver.gt(a, b) ? -1 : 0;

// ascending order
const compareArrays = (a, b) => compareText(a.join(), b.join());

const capitalize = (s) => {
    if (typeof s !== 'string') return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
};

const uniq = (array) => [...new Set(array)];

const getProjectName = (projectOrProjects) => {
    if (args.projectName) {
        return args.projectName;
    } else if (Array.isArray(projectOrProjects)) {
        return `${projectOrProjects.length} projects`;
    }
    // single project
    return projectOrProjects.name;
};

const getManifestName = (project, showManifestPrefix) => {
    if (args.parseManifestName) {
        if (showManifestPrefix) {
            return project.name;
        }
        return project.name.substring(project.name.indexOf(':') + 1);
    }
    return getProjectName(project);
};

const getUniqueProjectNamePrefixes = (projects) =>
    new Set(projects.map(({ name }) => name.substring(0, name.indexOf(':'))));

const getGraph = (issue, prefix, showFullManifest) => {
    const uniqueProjectNamePrefixes = getUniqueProjectNamePrefixes(
        issue.from.map(({ project }) => project)
    );
    const isMultipleBranches = uniqueProjectNamePrefixes.size > 1;
    return issue.from
        .map(({ project, paths }) => {
            const root = getManifestName(
                project,
                isMultipleBranches || showFullManifest
            );
            return `${prefix}${root} > ${paths.join(' > ')}`;
        })
        .join('\r\n');
};

module.exports = {
    capitalize,
    compare: {
        text: compareText,
        versions: compareVersions,
        arrays: compareArrays,
    },
    uniq,
    getProjectName,
    getUniqueProjectNamePrefixes,
    getGraph,
};
