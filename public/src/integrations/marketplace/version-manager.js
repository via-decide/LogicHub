(function (global) {
  'use strict';

  function parseVersion(version) {
    var raw = String(version || '').trim();
    if (!raw) return null;

    var cleaned = raw.replace(/^v/i, '');
    var parts = cleaned.split('.').map(function (part) { return Number(part); });
    if (parts.length !== 3 || parts.some(function (part) { return !Number.isFinite(part) || part < 0; })) {
      return null;
    }

    return { major: parts[0], minor: parts[1], patch: parts[2] };
  }

  function stringifyVersion(parts) {
    return [parts.major, parts.minor, parts.patch].join('.');
  }

  function bumpPatch(version) {
    var parsed = parseVersion(version);
    if (!parsed) return '0.1.0';
    return stringifyVersion({ major: parsed.major, minor: parsed.minor, patch: parsed.patch + 1 });
  }

  function resolveVersion(inputVersion, previousVersion) {
    var parsedInput = parseVersion(inputVersion);
    if (parsedInput) return stringifyVersion(parsedInput);

    var parsedPrevious = parseVersion(previousVersion);
    if (parsedPrevious) return bumpPatch(previousVersion);

    return '0.1.0';
  }

  global.LogicHubMarketplaceVersionManager = {
    parseVersion: parseVersion,
    bumpPatch: bumpPatch,
    resolveVersion: resolveVersion
  };
})(window);
