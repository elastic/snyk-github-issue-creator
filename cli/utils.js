'use strict';

const semver = require('semver');

const { conf } = require('./config');

// ascending order
const compareText = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());

// descending order
const compareSeverities = (a, b) => {
    if (a === b) {
        return 0;
    } else if (a === 'high') {
        return -1;
    } else if (b === 'high') {
        return 1;
    } else if (a === 'medium') {
        return -1;
    } else if (b === 'medium') {
        return 1;
    }
};

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
    if (conf.projectName) {
        return conf.projectName;
    } else if (Array.isArray(projectOrProjects)) {
        if (projectOrProjects.length === 1) {
            // single project
            return projectOrProjects[0].name;
        }
        return `${projectOrProjects.length} projects`;
    }
    // single project
    return projectOrProjects.name;
};

const getManifestName = (project, showManifestPrefix) => {
    if (conf.parseManifestName) {
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
    const pathsMap = issue.from.reduce((acc, { project, paths }) => {
        const root = getManifestName(
            project,
            isMultipleBranches || showFullManifest
        );
        let path;
        if (issue.from.length > 20 && paths.length > 1) {
            // If there are lots of paths, reduce those that are transitive dependencies
            path = `${paths[0]} > ... > ${paths[paths.length - 1]}`;
        } else {
            path = paths.join(' > ');
        }
        const key = `${prefix}${root} > ${path}`;
        const val = acc.get(key);
        if (val) {
            acc.set(key, val + 1);
        } else {
            acc.set(key, 1);
        }
        return acc;
    }, new Map());
    return Array.from(pathsMap.entries())
        .map(([k, v]) => (v === 1 ? k : k.replace('...', `... (x${v})`)))
        .join('\r\n');
};

module.exports = {
    capitalize,
    compare: {
        text: compareText,
        severities: compareSeverities,
        versions: compareVersions,
        arrays: compareArrays,
    },
    uniq,
    getProjectName,
    getUniqueProjectNamePrefixes,
    getGraph,
};
