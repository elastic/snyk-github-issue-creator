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

// The semver package doesn't support version strings with four parts (e.g 1.2.3.4)
// We hack by converting `1.2.3.4` to `1.2.3-4` where `4` is considered a pre-release version identifier, which semver supports.
const fourPartVersionRegEx = /(\d+\.\d+\.\d+)\.(.*)/;
const normalizeFourPartVersion = (version) => {
    const match = version.match(fourPartVersionRegEx);
    return match ? `${match[1]}-${match[2]}` : version;
};

// descending order
const compareVersions = (a, b) => {
    a = normalizeFourPartVersion(a);
    b = normalizeFourPartVersion(b);
    return semver.lt(a, b) ? 1 : semver.gt(a, b) ? -1 : 0;
}

// descending order
const compareVersionArrays = (a, b) => {
    a = a.sort(compareVersions);
    b = b.sort(compareVersions);
    const min = Math.min(a.length, b.length);
    for (let i = 0; i < min; i++) {
        const result = compareVersions(a[i], b[i]);
        if (result !== 0) return result;
    }
    return 0;
};

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

const pathToString = ({ name, version }) =>
    `${name}@${version}`;

const getGraph = (issue, prefix, showFullManifest) => {
    const uniqueProjectNamePrefixes = getUniqueProjectNamePrefixes(
        issue.from.map(({ project }) => project)
    );

    const isMultipleBranches = uniqueProjectNamePrefixes.size > 1;
    const hideTransitiveDependencies = issue.from.reduce((total, { paths }) => total + paths.length, 0) > 20 // If there are lots of paths, reduce those that are transitive dependencies
    const pathsMap = new Map();

    for (const { project, paths } of issue.from) {
        const root = getManifestName(
            project,
            isMultipleBranches || showFullManifest
        );

        for (let path of paths) {
            let pathStr;
            path = path.map(pathToString);
            if (hideTransitiveDependencies && path.length > 2) {
                pathStr = `${path[0]} > ... > ${path[path.length - 1]}`;
            } else {
                pathStr = path.join(' > ');
            }
            const key = `${prefix}${root} > ${pathStr}`;
            const val = pathsMap.get(key);
            if (val) {
                pathsMap.set(key, val + 1);
            } else {
                pathsMap.set(key, 1);
            }
        }
    }

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
        versionArrays: compareVersionArrays,
        arrays: compareArrays,
    },
    uniq,
    getProjectName,
    getUniqueProjectNamePrefixes,
    getGraph,
};
