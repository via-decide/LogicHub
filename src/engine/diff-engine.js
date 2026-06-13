/**
 * Module 4: App Diff Engine
 * Compares two versions of a project (UI, Features, Dependencies, APIs)
 * and generates a Change Report with a Risk Score.
 */
export class AppDiffEngine {
  /**
   * Compares Version A and Version B to extract deltas.
   * @param {Object} versionA - The previous version record
   * @param {Object} versionB - The newly upgraded version record
   * @returns {Object} Change Report
   */
  calculateDiff(versionA, versionB) {
    const added = [];
    const removed = [];
    const modified = [];
    let riskScore = 0;

    // 1. Dependency Delta
    const depsA = new Set(versionA.dependencyGraph || []);
    const depsB = new Set(versionB.dependencyGraph || []);

    for (const dep of depsB) {
      if (!depsA.has(dep)) {
        added.push(`Dependency: ${dep}`);
        riskScore += 10; // New dependencies introduce risk
      }
    }
    for (const dep of depsA) {
      if (!depsB.has(dep)) {
        removed.push(`Dependency: ${dep}`);
        riskScore += 5; // Removing might cause regressions
      }
    }

    // 2. Feature Delta
    const featA = new Set(versionA.featureMap || []);
    const featB = new Set(versionB.featureMap || []);

    for (const feat of featB) {
      if (!featA.has(feat)) {
        added.push(`Feature: ${feat}`);
        riskScore += 15; // New core features
      }
    }
    for (const feat of featA) {
      if (!featB.has(feat)) {
        removed.push(`Feature: ${feat}`);
        riskScore += 10;
      }
    }

    // 3. Architecture / UI Delta
    // Simple heuristic comparing keys of the architecture map
    const archA = Object.keys(versionA.architectureMap || {});
    const archB = Object.keys(versionB.architectureMap || {});
    
    if (archA.join(',') !== archB.join(',')) {
      modified.push('Core Architectural Structure');
      riskScore += 30; // Major restructuring is high risk
    } else if (depsB.size > depsA.size) {
      modified.push('Underlying APIs / Services updated');
      riskScore += 10;
    }

    // Normalize risk score (0-100)
    riskScore = Math.min(100, Math.max(0, riskScore));

    return {
      versionA: versionA.versionName || 'Previous',
      versionB: versionB.versionName || 'Current',
      added,
      removed,
      modified,
      riskScore
    };
  }
}
