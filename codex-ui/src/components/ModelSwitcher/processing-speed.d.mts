import type {CatalogModel} from './model-catalog';
import type {ConnectionMode} from '../../state/useConnection';
export type ProcessingMode='standard'|'fast'|'ultrafast';
export const processingModes:ProcessingMode[];
export function processingMode(id:string):ProcessingMode;
export function speedChoices(models:CatalogModel[],id:string,route:ConnectionMode):(CatalogModel|null)[];
