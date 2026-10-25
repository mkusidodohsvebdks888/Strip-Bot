export type DroppedFile = {
  path?: string;
  name?: string;
  size?: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};
export type DropDataTransfer = {
  files?: ArrayLike<DroppedFile> | Iterable<DroppedFile>;
  items?: ArrayLike<unknown> | Iterable<unknown>;
  getData?(type: string): string;
};
export function fileUriToPath(uri: unknown): string | null;
export function isAbsolutePath(path: string): boolean;
export function extractDroppedPaths(
  dataTransfer: DropDataTransfer,
  resolvePath?: ((file: DroppedFile) => string | null | undefined) | null,
): string[];
export function collectEntries(
  items: ArrayLike<unknown> | Iterable<unknown>,
  options?: {maxFiles?: number; maxBytes?: number},
): Promise<{files: Array<{path: string; file: File}>; roots: string[]}>;
export function findSkillRoots(paths: string[]): string[];
export function filesToPayload(files: Array<{path: string; file: File}>): Promise<Array<{path: string; base64: string}>>;
export const MAX_SKILL_FILES: number;
export const MAX_SKILL_BYTES: number;