export type IssuePresentation={title:string;summary:string;detail:string;interrupted:boolean};
export function issueText(value:unknown):string;
export function presentIssue(value:unknown):IssuePresentation;
export function selectRelevantIssue<T extends {raw:unknown}>(items:T[]):T|undefined;

export function selectTurnIssue(messages:Array<{id?:string;type?:string;error?:unknown}>,conversationError?:unknown):{id:string;raw:unknown}|undefined;

