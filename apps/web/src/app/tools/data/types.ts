export interface ContractField {
  layer: string;
  t_meaning: string;
}

export interface ProjectCard {
  name: string;
  content: string;
}

export interface ProductionStage {
  num: string;
  desc: string;
}

export interface ToolData {
  id: string;
  title: string;
  eyebrow: string;
  lead: string;
  contractFields: ContractField[];
  projects: ProjectCard[];
  stages: ProductionStage[];
  checklist: string[];
}
