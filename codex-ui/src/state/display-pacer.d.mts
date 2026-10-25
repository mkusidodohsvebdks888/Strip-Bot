export function displayCost(character:string):number;
export class DisplayPacer{
  constructor(text?:string,rate?:number|null,animate?:boolean);
  readonly done:boolean;finish():string;
  target:string;visible:string;rate:number|null;credit:number;
  setTarget(text:string):void;setRate(rate:number|null):void;reset(text:string):void;tick(seconds:number):string;
}
