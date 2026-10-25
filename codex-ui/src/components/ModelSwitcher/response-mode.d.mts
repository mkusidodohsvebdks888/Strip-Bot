import type {CatalogModel} from './model-catalog';
import type {ConnectionMode} from '../../state/useConnection';
export type ResponsePresetID='sprint'|'fast'|'balanced'|'deep'|'maximum';
export type ResponseOption={id:ResponsePresetID;label:string;effort:string;preferredSpeed:string;description:string;displayRate:number|null;model:string;variant:string;supported:boolean;reasoningSupported:boolean;speedMode:string;speedModelAvailable:boolean;displayOnly:boolean};
export const responsePresets:ReadonlyArray<Pick<ResponseOption,'id'|'label'|'effort'|'preferredSpeed'|'description'|'displayRate'>>;
export function responseOptions(models:CatalogModel[],route:ConnectionMode,modelId:string):ResponseOption[];
export function activePresetIndex(presetId:string,variant:string,variants?:{id:string;effort:string}[]):number;
