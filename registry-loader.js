(function (global) {
  'use strict';

  const PEOPLE_ROOT = './people';

  async function fromRegistryJson() {
    try {
      const response = await fetch('./people-registry.json', { cache: 'no-store' });
      if (!response.ok) return [];

      const data = await response.json();
      return Array.isArray(data && data.people) ? data.people : [];
    } catch (_error) {
      return [];
    }
  }

  global.RegistryLoader = {
    PEOPLE_ROOT,
    fromRegistryJson
  };
})(window);
