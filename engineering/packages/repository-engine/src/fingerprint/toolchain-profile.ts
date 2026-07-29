import { readFile } from 'node:fs/promises';
import { sha256Hex } from '../util/hash.js';
import { jcsCanonicalize } from '../util/jcs.js';
import type { ToolchainProfile } from '../types.js';

export async function loadToolchainProfile(profilePath: string): Promise<{
  profile: ToolchainProfile;
  profileHash: string;
}> {
  const raw = await readFile(profilePath, 'utf-8');
  const parsed = JSON.parse(raw) as ToolchainProfile;
  const canonical = jcsCanonicalize(parsed);
  const profileHash = sha256Hex(canonical);
  return { profile: parsed, profileHash };
}
