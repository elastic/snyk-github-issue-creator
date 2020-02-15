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

module.exports = {
  compareText
};
