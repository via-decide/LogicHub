export interface ArtifactMetadata {
  sha256: string;
  mediaType: string;
  byteSize: number;
  createdAt: string;
  filename?: string;
}

export interface PutResult {
  sha256: string;
  byteSize: number;
  alreadyExisted: boolean;
}

export interface ArtifactStore {
  put(content: Buffer, metadata: Omit<ArtifactMetadata, 'sha256' | 'byteSize'>): Promise<PutResult>;
  get(sha256: string): Promise<Buffer | null>;
  getMetadata(sha256: string): Promise<ArtifactMetadata | null>;
  verify(sha256: string): Promise<boolean>;
  exists(sha256: string): Promise<boolean>;
}
