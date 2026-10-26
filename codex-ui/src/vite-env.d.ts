/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

interface Window { stripWindowAppearance?: {sync:(appearance:'warm'|'white'|'dark'|'mist'|'graphite')=>void}; }
interface Window {stripUpdates?:{status:()=>Promise<import('./components/DesktopUpdates').UpdateState>;check:()=>Promise<import('./components/DesktopUpdates').UpdateState>;download:()=>Promise<import('./components/DesktopUpdates').UpdateState>;install:()=>Promise<import('./components/DesktopUpdates').UpdateState>;onStatus:(listener:(state:import('./components/DesktopUpdates').UpdateState)=>void)=>()=>void};}
