import {useRef,useState} from 'react';
import {modelVendor} from '../components/model-vendors';
const storageKey='strip_model_display_rates_v3';
type Rates=Record<string,number|null>;
function read():Rates{try{const value=JSON.parse(localStorage.getItem(storageKey) || '{}');return value && typeof value==='object' && !Array.isArray(value)?Object.fromEntries(Object.entries(value).filter((entry):entry is [string,number|null]=>entry[1]===null || typeof entry[1]==='number' && entry[1]>=10 && entry[1]<=200 && entry[1]%10===0)):{};}catch{return {};}}
export function useDisplayRate(model:string){
  const [rates,setRates]=useState(read),saved=useRef(rates),[error,setError]=useState('');
  const modelKey=(id:string)=>modelVendor(id)+':'+id;
  const key=modelKey(model);
  function preview(rate:number|null){setError('');setRates(previous=>({...previous,[key]:rate}));}
  function commitForModel(targetModel:string,rate:number|null){
    try{const next={...saved.current,[modelKey(targetModel)]:rate};localStorage.setItem(storageKey,JSON.stringify(next));saved.current=next;setRates(next);setError('');}
    catch{setRates(saved.current);setError('显示速率保存失败，已恢复之前的设置。');}
  }
  function commit(rate:number|null){commitForModel(model,rate);}
  return {rate:rates[key] ?? null,preview,commit,commitForModel,error};
}
