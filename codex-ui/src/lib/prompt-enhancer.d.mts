export type InstructionContext = { workspace?: string; files?: string[] };
export function isStructuredInstruction(text:string): boolean;
export function extractTask(text:string): string;
export function buildInstruction(raw:string, ctx?:InstructionContext): string;
export type SlashCommand = {cmd:string; label:string; template:string};
export const SLASH_COMMANDS: SlashCommand[];
export function expandSlash(text:string): string | null;
export function matchSlash(text:string): SlashCommand[];
export function enhanceWithModel(raw:string, options?:{
  endpoint?:string;
  model?:string;
  signal?:AbortSignal;
  mapRequest?:(payload:unknown)=>unknown;
  mapResponse?:(data:unknown)=>unknown;
}): Promise<string>;