import type Database from 'better-sqlite3';
import { createDatabase, runMigrations } from '@logichub-engineering/persistence';
import {
  SqliteProjectRepository,
  SqliteRevisionRepository,
  SqliteEngineeringObjectRepository,
  SqliteConstraintRepository,
  SqliteDecisionRepository,
  SqliteArtifactRepository,
  SqliteChangeIntentRepository,
  SqliteValidationResultRepository,
  SqliteModuleRepository,
  SqliteEngineeringPullRequestRepository,
} from '@logichub-engineering/persistence';
import { LocalArtifactStore, type ArtifactStore } from '@logichub-engineering/artifact-store';
import {
  ImportService,
  RevisionComparisonService,
  ReviewService,
  MergeService,
  BranchService,
  CatalogService,
  type KicadAdapter,
} from '@logichub-engineering/domain';

export interface AppContextOptions {
  dbPath: string;
  artifactStoreRoot: string;
  /** Override the KicadAdapter ImportService uses -- for tests that simulate a toolchain-equipped environment. Defaults to a real KicadAdapter. */
  kicad?: KicadAdapter;
}

/**
 * The composition root: the one place allowed to import persistence and
 * artifact-store directly (to construct concrete implementations), wiring
 * them into domain's services. Every route handler talks only to the
 * services on this context -- never to a repository or engine package
 * directly (ADR-0003: apps/api imports only from domain).
 */
export interface AppContext {
  db: Database.Database;
  artifactStore: ArtifactStore;
  importService: ImportService;
  comparisonService: RevisionComparisonService;
  reviewService: ReviewService;
  mergeService: MergeService;
  branchService: BranchService;
  catalogService: CatalogService;
}

export function createAppContext(options: AppContextOptions): AppContext {
  const db = createDatabase({ path: options.dbPath });
  runMigrations(db);

  const projectRepo = new SqliteProjectRepository(db);
  const revisionRepo = new SqliteRevisionRepository(db);
  const objectRepo = new SqliteEngineeringObjectRepository(db);
  const constraintRepo = new SqliteConstraintRepository(db);
  const decisionRepo = new SqliteDecisionRepository(db);
  const artifactRepo = new SqliteArtifactRepository(db);
  const changeIntentRepo = new SqliteChangeIntentRepository(db);
  const validationResultRepo = new SqliteValidationResultRepository(db);
  const moduleRepo = new SqliteModuleRepository(db);
  const pullRequestRepo = new SqliteEngineeringPullRequestRepository(db);

  const artifactStore = new LocalArtifactStore(options.artifactStoreRoot);

  return {
    db,
    artifactStore,
    importService: new ImportService({
      projectRepo, revisionRepo, objectRepo, artifactRepo, validationResultRepo, artifactStore, kicad: options.kicad,
    }),
    comparisonService: new RevisionComparisonService({ revisionRepo, objectRepo, constraintRepo, artifactRepo, artifactStore }),
    reviewService: new ReviewService({ pullRequestRepo }),
    mergeService: new MergeService({
      revisionRepo, pullRequestRepo, validationResultRepo, constraintRepo, artifactRepo, decisionRepo, objectRepo, artifactStore,
    }),
    branchService: new BranchService({ projectRepo }),
    catalogService: new CatalogService({
      projectRepo, revisionRepo, objectRepo, changeIntentRepo, validationResultRepo, artifactRepo, moduleRepo, pullRequestRepo,
    }),
  };
}
