'use strict';

const semver = require('semver');

const { conf } = require('./config');

// ascending order
const compareText = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());

// descending order
const compareSeverities = (a, b) => {
    if (a === b) {
        return 0;
    } else if (a === 'critical') {
        return -1;
    } else if (b === 'critical') {
        return 1;
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
};
