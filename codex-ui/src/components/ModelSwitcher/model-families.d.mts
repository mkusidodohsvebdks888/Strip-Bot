import type {CatalogModel} from './model-catalog';
import type {ConnectionMode} from '../../state/useConnection';
export type ModelFamily={id:string;name:string;vendorId:string;models:CatalogModel[]};
export function familyID(id:string):string;
export function familyName(name:string):string;
export function modelFamilies(models:CatalogModel[]):ModelFamily[];
export function familyChoice(family:ModelFamily,route:ConnectionMode,currentModel:string):CatalogModel|null;
