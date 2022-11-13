'use strict';

const { conf } = require('../config');

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
    getProjectName,
    getUniqueProjectNamePrefixes,
    getGraph,
};
