import type {ApprovalMode} from '../components/AgentPanel';
export function approvalPreferenceKey(workspace:string,connection:string):string;
export function readApprovalPreference(storage:Storage,workspace:string,connection:string):ApprovalMode;
export function writeApprovalPreference(storage:Storage,workspace:string,connection:string,mode:ApprovalMode):void;
