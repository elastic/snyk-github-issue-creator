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

const normalizeVersion = (version) => {
    version = normalizeFourPartVersion(version);

    const cleanedVersion = semver.clean(version);
    if (cleanedVersion) return cleanedVersion;

    const coercedVersion = semver.coerce(version);
    if (coercedVersion) return coercedVersion.version;

    return version;
};

// descending order
const compareVersions = (a, b) => {
    a = normalizeVersion(a);
    b = normalizeVersion(b);
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
};
