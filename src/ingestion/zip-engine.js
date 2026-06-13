import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Module 2: ZIP Import Engine
 * Unpacks source archives, detects frameworks, and builds dependency graphs.
 */
export class ZipEngine {
  constructor(workDir = os.tmpdir()) {
    this.workDir = workDir;
  }

  /**
   * Analyzes a source ZIP archive and generates a Repository Intelligence Report
   * @param {string} zipPath - Absolute path to the uploaded .zip file
   * @returns {Promise<Object>} The Repository Intelligence Report
   */
  async analyze(zipPath) {
    console.log(`[ZIP Engine] Starting extraction for ${zipPath}`);
    const jobId = crypto.randomUUID();
    const extractDir = path.join(this.workDir, `zip-extract-${jobId}`);

    try {
      // 1. Unpack source
      await this.extractZip(zipPath, extractDir);

      // 2. Determine root directory (sometimes zip wraps in a single top-level folder)
      const projectRoot = await this.resolveProjectRoot(extractDir);

      // 3. Detect Framework & Parse Dependencies
      const frameworkInfo = await this.detectFrameworkAndDependencies(projectRoot);

      // 4. Generate Architecture Map
      const architectureMap = await this.generateArchitectureMap(projectRoot);

      // 5. Generate Upgrade Opportunities
      const improvements = this.generateImprovements(frameworkInfo);

      return {
        success: true,
        report: {
          framework: frameworkInfo.framework,
          language: frameworkInfo.language,
          dependencies: frameworkInfo.dependencies,
          architectureMap: architectureMap,
          potentialImprovements: improvements,
          buildFailuresDetected: [] // Simulated logic for static build detection
        }
      };
    } catch (error) {
      console.error('[ZIP Engine] Analysis failed:', error);
      return { success: false, error: error.message };
    } finally {
      // Cleanup
      await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  async extractZip(zipPath, outputDir) {
    await fs.mkdir(outputDir, { recursive: true });
    // Using native macOS unzip
    await execAsync(`unzip -q "${zipPath}" -d "${outputDir}"`);
  }

  async resolveProjectRoot(extractDir) {
    const entries = await fs.readdir(extractDir, { withFileTypes: true });
    // If the zip contains exactly one folder, that folder is the true root
    if (entries.length === 1 && entries[0].isDirectory()) {
      return path.join(extractDir, entries[0].name);
    }
    return extractDir;
  }

  async detectFrameworkAndDependencies(projectRoot) {
    const result = {
      framework: 'Unknown',
      language: 'Unknown',
      dependencies: []
    };

    try {
      // Check Node.js / React / React Native
      const pkgPath = path.join(projectRoot, 'package.json');
      const pkgStat = await fs.stat(pkgPath).catch(() => null);
      if (pkgStat) {
        const pkgData = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
        const deps = { ...pkgData.dependencies, ...pkgData.devDependencies };
        result.dependencies = Object.keys(deps);

        if (deps['react-native']) {
          result.framework = 'React Native';
          result.language = 'TypeScript/JavaScript';
        } else if (deps['next']) {
          result.framework = 'Next.js';
          result.language = 'TypeScript/JavaScript';
        } else if (deps['react']) {
          result.framework = 'React';
          result.language = 'TypeScript/JavaScript';
        } else if (deps['express']) {
          result.framework = 'Node.js (Express)';
          result.language = 'JavaScript';
        } else {
          result.framework = 'Node.js';
        }
        return result;
      }

      // Check Flutter
      const pubspecPath = path.join(projectRoot, 'pubspec.yaml');
      const pubStat = await fs.stat(pubspecPath).catch(() => null);
      if (pubStat) {
        result.framework = 'Flutter';
        result.language = 'Dart';
        // Rudimentary yaml parsing for dependencies
        const pubData = await fs.readFile(pubspecPath, 'utf8');
        const depMatches = pubData.match(/^  ([a-z0-9_]+):/gm);
        if (depMatches) {
          result.dependencies = depMatches.map(m => m.replace(':', '').trim());
        }
        return result;
      }

      // Check Android / Spring Boot (Gradle)
      const gradlePath = path.join(projectRoot, 'build.gradle');
      const ktsPath = path.join(projectRoot, 'build.gradle.kts');
      if (await fs.stat(gradlePath).catch(() => null) || await fs.stat(ktsPath).catch(() => null)) {
        const gradleContent = await fs.readFile(gradlePath).catch(() => fs.readFile(ktsPath));
        if (gradleContent.toString().includes('org.springframework.boot')) {
          result.framework = 'Spring Boot';
          result.language = 'Java/Kotlin';
        } else {
          result.framework = 'Android Native';
          result.language = 'Kotlin/Java';
        }
        return result;
      }

    } catch (e) {
      console.warn('[ZIP Engine] Error detecting framework', e);
    }

    return result;
  }

  async generateArchitectureMap(projectRoot) {
    // Generate a high-level tree of important architectural folders
    const map = {};
    const importantDirs = ['src', 'lib', 'app', 'components', 'pages', 'api', 'android', 'ios'];
    
    for (const dir of importantDirs) {
      const dirPath = path.join(projectRoot, dir);
      if (await fs.stat(dirPath).catch(() => null)) {
        map[dir] = await fs.readdir(dirPath).catch(() => []);
      }
    }
    return map;
  }

  generateImprovements(frameworkInfo) {
    const improvements = [];
    
    if (frameworkInfo.framework === 'React Native') {
      if (!frameworkInfo.dependencies.includes('react-native-reanimated')) {
        improvements.push('Migrate to Reanimated 3 for 60fps UI threads.');
      }
    } else if (frameworkInfo.framework === 'Flutter') {
      improvements.push('Implement Riverpod for robust state management.');
    } else if (frameworkInfo.framework.includes('React')) {
      improvements.push('Extract logical components to custom hooks.');
    } else if (frameworkInfo.framework === 'Spring Boot') {
      improvements.push('Upgrade to Spring Boot 3 / JDK 17 for better AOT compilation.');
    }

    improvements.push('Attach Zayvora Reasoning SDK for native AI capabilities.');
    return improvements;
  }
}
