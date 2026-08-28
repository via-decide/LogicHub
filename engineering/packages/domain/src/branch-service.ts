import { createLogicHubError } from '@logichub-engineering/shared';
import type { Project } from '@logichub-engineering/contracts';
import type { ProjectRepository } from '@logichub-engineering/persistence';
import { GitRepository, type BranchInfo } from '@logichub-engineering/git-adapter';

export interface BranchServiceDeps {
  projectRepo: ProjectRepository;
}

/** Thin git-adapter wrapper kept in domain per ADR-0003 (apps/api never imports engine packages directly). */
export class BranchService {
  constructor(private readonly deps: BranchServiceDeps) {}

  async listBranches(projectId: string): Promise<BranchInfo[]> {
    const project = await this.requireProject(projectId);
    const git = await GitRepository.open(project.repository.localPath);
    return git.listBranches();
  }

  async createBranch(projectId: string, name: string, startPoint: string): Promise<BranchInfo> {
    const project = await this.requireProject(projectId);
    const git = await GitRepository.open(project.repository.localPath);
    return git.createBranch(name, startPoint);
  }

  private async requireProject(projectId: string): Promise<Project> {
    const project = await this.deps.projectRepo.findById(projectId);
    if (!project) {
      throw createLogicHubError('LH_PROJECT_NOT_FOUND', `Project ${projectId} does not exist`, {
        entityIds: { projectId },
      });
    }
    return project;
  }
}
