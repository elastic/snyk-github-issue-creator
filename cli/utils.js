const args = require('minimist')(process.argv.slice(2));

const compareText = (a, b) => {
    const _a = a.toLowerCase();
    const _b = b.toLowerCase();
    if (_a < _b) {
        return -1;
    } else if (_a > _b) {
        return 1;
    }
    return 0;
};

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

const getManifestName = (project) => {
    if (args.parseManifestName) {
        return project.name.substring(project.name.indexOf(':') + 1);
    }
    return getProjectName(project);
};

const getGraph = (issue, prefix) => {
    return issue.from
        .map(
            ({ project, paths }) =>
                `${prefix}${getManifestName(project)} > ${paths.join(' > ')}`
        )
        .join('\r\n');
};

module.exports = {
    capitalize,
    compareText,
    uniq,
    getProjectName,
    getGraph,
};
