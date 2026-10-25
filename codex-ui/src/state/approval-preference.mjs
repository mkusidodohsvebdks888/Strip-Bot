export function approvalPreferenceKey(workspace,connection){
  return 'strip_approval_default_v1:'+connection+':'+workspace.replace(/\\/g,'/').replace(/\/+$/,'').toLowerCase();
}
export function readApprovalPreference(storage,workspace,connection){
  if(!workspace)return 'ask';
  try{return storage.getItem(approvalPreferenceKey(workspace,connection))==='allow-all'?'allow-all':'ask';}catch{return 'ask';}
}
export function writeApprovalPreference(storage,workspace,connection,mode){
  if(!workspace || !['ask','allow-all'].includes(mode))throw new Error('请先选择有效项目。');
  try{storage.setItem(approvalPreferenceKey(workspace,connection),mode);}catch{throw new Error('无法记住权限选择，请检查本地存储空间。');}
}
