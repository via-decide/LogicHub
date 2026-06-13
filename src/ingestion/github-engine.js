import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { ZipEngine } from './zip-engine.js';

const execAsync = promisify(exec);

/**
 * Module 3: GitHub Import Engine
 * Clones repository, analyzes structure, generates Technical Debt report,
 * and initializes Project Memory for Zayvora reasoning.
 */
export class GitHubEngine {
  constructor(workDir = os.tmpdir()) {
    this.workDir = workDir;
    this.zipAnalyzer = new ZipEngine(workDir);
  }

  /**
   * Imports and analyzes a GitHub repository
   * @param {string} githubUrl - The HTTPS URL of the repository
   * @param {string} token - Optional PAT for private repositories
   * @returns {Promise<Object>} The Repository Intelligence Report + Memory Context
   */
  async analyze(githubUrl, token = null) {
    console.log(`[GitHub Engine] Starting import for ${githubUrl}`);
    const jobId = crypto.randomUUID();
    const cloneDir = path.join(this.workDir, `github-clone-${jobId}`);

    try {
      // 1. Clone the repository
      await this.cloneRepo(githubUrl, cloneDir, token);

      // 2. Delegate to standard directory analysis (reusing ZipEngine logic)
      const frameworkInfo = await this.zipAnalyzer.detectFrameworkAndDependencies(cloneDir);
      const architectureMap = await this.zipAnalyzer.generateArchitectureMap(cloneDir);

      // 3. Generate Feature Map
      const featureMap = this.generateFeatureMap(architectureMap, frameworkInfo);

      // 4. Generate Technical Debt Report
      const debtReport = await this.analyzeTechnicalDebt(cloneDir, frameworkInfo);

      // 5. Generate Context Memory for Zayvora
      const memoryContext = this.buildProjectMemory(githubUrl, frameworkInfo, architectureMap, debtReport);

      return {
        success: true,
        report: {
          framework: frameworkInfo.framework,
          language: frameworkInfo.language,
          dependencies: frameworkInfo.dependencies,
          architectureMap: architectureMap,
          featureMap: featureMap,
          technicalDebt: debtReport,
          potentialImprovements: this.zipAnalyzer.generateImprovements(frameworkInfo),
          memoryContext: memoryContext
        }
      };
    } catch (error) {
      console.error('[GitHub Engine] Import failed:', error);
      return { success: false, error: error.message };
    } finally {
      // Cleanup
      await fs.rm(cloneDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  async cloneRepo(url, outputDir, token) {
    let cloneUrl = url;
    if (token) {
      // Inject token into HTTPS URL for private repos
      const urlObj = new URL(url);
      urlObj.username = 'x-access-token';
      urlObj.password = token;
      cloneUrl = urlObj.toString();
    }
    
    // --depth 1 for shallow clone to save bandwidth/time
    await execAsync(`git clone --depth 1 "${cloneUrl}" "${outputDir}"`);
  }

  generateFeatureMap(architectureMap, frameworkInfo) {
    const features = [];
    
    // Basic heuristics based on folder presence
    if (architectureMap['api']) features.push('REST API Integration');
    if (architectureMap['components']) features.push('Reusable UI Component Library');
    if (architectureMap['pages'] || architectureMap['app']) features.push('Page-based Routing');
    
    if (frameworkInfo.dependencies.includes('firebase')) features.push('Firebase BaaS Integration');
    if (frameworkInfo.dependencies.includes('redux') || frameworkInfo.dependencies.includes('zustand')) {
      features.push('Global State Management');
    }
    if (frameworkInfo.dependencies.includes('prisma')) features.push('ORM Database Layer');

    return features;
  }

  async analyzeTechnicalDebt(projectRoot, frameworkInfo) {
    const debt = [];
    
    // 1. Check for legacy dependencies
    const deps = frameworkInfo.dependencies || [];
    if (deps.includes('moment')) debt.push('Legacy Date library (moment.js) detected. Consider dayjs or date-fns.');
    if (deps.includes('request')) debt.push('Deprecated "request" package detected. Use native fetch or axios.');
    if (frameworkInfo.framework === 'React' && !deps.includes('typescript')) {
      debt.push('Missing TypeScript. High risk of runtime type errors.');
    }

    // 2. Check for missing tests
    const hasTests = await fs.stat(path.join(projectRoot, 'test')).catch(() => null) || 
                     await fs.stat(path.join(projectRoot, 'tests')).catch(() => null) ||
                     deps.includes('jest');
    
    if (!hasTests) {
      debt.push('No obvious test framework or /tests directory detected.');
    }

    // 3. Check for heavy monolithic folders
    const srcDir = path.join(projectRoot, 'src');
    if (await fs.stat(srcDir).catch(() => null)) {
      const srcFiles = await fs.readdir(srcDir);
      if (srcFiles.length > 20) {
        debt.push('/src directory is overcrowded. Consider domain-driven modularization.');
      }
    }

    return debt;
  }

  buildProjectMemory(githubUrl, frameworkInfo, architectureMap, debtReport) {
    // This string acts as the foundation context injected into the Zayvora prompt window
    return `PROJECT SOURCE: ${githubUrl}
FRAMEWORK: ${frameworkInfo.framework} (${frameworkInfo.language})
DEPENDENCIES: ${frameworkInfo.dependencies.join(', ')}

ARCHITECTURE:
${JSON.stringify(architectureMap, null, 2)}

TECHNICAL DEBT:
${debtReport.map(d => '- ' + d).join('\n')}

INSTRUCTIONS FOR ZAYVORA:
This project has been imported into LogicHub V2. When the user requests an upgrade, 
prioritize resolving the technical debt listed above while preserving the core architectural map.`;
  }
}
