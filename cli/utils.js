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
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const uniq = (array) => [...new Set(array)];

module.exports = {
  capitalize,
  compareText,
  uniq
};
