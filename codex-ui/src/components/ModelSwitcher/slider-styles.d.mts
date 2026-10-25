export type SliderStyle = 'dots'|'line'|'pill'|'segments'|'gradient'|'energy';
export const sliderStyleKey: string;
export const sliderStyleEvent: string;
export const defaultSliderStyle: SliderStyle;
export const sliderStyles: ReadonlyArray<Readonly<{id:SliderStyle;label:string;description:string}>>;
export function normalizeSliderStyle(value:unknown):SliderStyle;
export function readSliderStyle(storage?:Pick<Storage,'getItem'>):SliderStyle;
export function saveSliderStyle(value:unknown,storage?:Pick<Storage,'setItem'>):SliderStyle;
