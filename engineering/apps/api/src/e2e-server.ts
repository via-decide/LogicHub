import { buildServer } from './server.js';
import { KicadAdapter, type KicadProjectFiles, type CheckResult } from '@logichub-engineering/kicad-adapter';

/**
 * TEST-ONLY entrypoint for Playwright e2e coverage (Phase 8). This sandbox
 * has no kicad-cli, so a real KicadAdapter honestly reports ERC/DRC as
 * 'skipped' -- which is correct, but would leave every pull request
 * permanently blocked on merge gate #11 ("no required validation remains
 * unknown"), making the merge half of the primary user path unreachable
 * through the browser. This entrypoint simulates a toolchain-equipped
 * environment for ERC/DRC ONLY (identical to the stub already used in
 * packages/domain/__tests__/merge-service.test.ts and
 * apps/api/__tests__/api.test.ts) so that path is exercisable end to end.
 * Parsing, extraction, fingerprinting, diffing, constraint evaluation, and
 * merge-gate policy are all completely real -- nothing else is faked.
 *
 * Never used in production: src/main.ts is the real entrypoint and has no
 * such override.
 */
class ToolchainAvailableKicadAdapter extends KicadAdapter {
  override async runErc(_files: KicadProjectFiles): Promise<CheckResult> {
    return { status: 'pass', diagnostics: [], report: null, toolVersion: 'e2e-simulated' };
  }
  override async runDrc(_files: KicadProjectFiles): Promise<CheckResult> {
    return { status: 'pass', diagnostics: [], report: null, toolVersion: 'e2e-simulated' };
  }
}

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const app = buildServer({
  logger: false,
  contextOptions: {
    dbPath: process.env.LOGICHUB_DB_PATH ?? ':memory:',
    artifactStoreRoot: process.env.LOGICHUB_ARTIFACT_STORE ?? './e2e-artifacts',
    kicad: new ToolchainAvailableKicadAdapter(),
  },
});

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
