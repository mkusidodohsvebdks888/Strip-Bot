import {useId} from 'react';
import {isEdgeLit} from './task-flow-plan.ts';
import type {TaskNode, TaskPlan, TaskStatus} from './task-flow-plan.ts';

export type {TaskEdge, TaskEvent, TaskNode, TaskPlan, TaskStatus} from './task-flow-plan.ts';
export {applyTaskEvent, isEdgeLit, taskPlanFromEvents, taskStatusFromActivity} from './task-flow-plan.ts';

const labels: Record<TaskStatus,string> = {
  pending:'待执行', running:'执行中', completed:'已完成', failed:'失败', cancelled:'已停止',
};
const W=212, H=88, XGAP=78, YGAP=38, PAD=28;

// Topological ranks allow branches and joins. Cycles must be corrected in the plan.
function layout(plan: TaskPlan) {
  const ids=new Set(plan.nodes.map(n=>n.id));
  if(ids.size!==plan.nodes.length) throw new Error('任务 ID 不能重复');
  const indegree=new Map(plan.nodes.map(n=>[n.id,0]));
  const rank=new Map(plan.nodes.map(n=>[n.id,0]));
  const outgoing=new Map(plan.nodes.map(n=>[n.id,[] as string[]]));
  const edgeIds=new Set<string>();
  for(const e of plan.edges){
    if(edgeIds.has(e.id)) throw new Error('连线 ID 不能重复');
    edgeIds.add(e.id);
    if(!ids.has(e.from)||!ids.has(e.to)) throw new Error('连线引用了不存在的任务');
    outgoing.get(e.from)!.push(e.to);
    indegree.set(e.to,indegree.get(e.to)!+1);
  }
  const queue=plan.nodes.filter(n=>indegree.get(n.id)===0).map(n=>n.id);
  let visited=0;
  for(let i=0;i<queue.length;i++){
    const id=queue[i]; visited++;
    for(const next of outgoing.get(id)!){
      rank.set(next,Math.max(rank.get(next)!,rank.get(id)!+1));
      indegree.set(next,indegree.get(next)!-1);
      if(indegree.get(next)===0) queue.push(next);
    }
  }
  if(visited!==plan.nodes.length) throw new Error('流程包含循环依赖，请先修正任务计划');
  const layers=new Map<number,TaskNode[]>();
  for(const n of plan.nodes){ const r=rank.get(n.id)!; layers.set(r,[...(layers.get(r)||[]),n]); }
  const rows=Math.max(1,...Array.from(layers.values()).map(v=>v.length));
  const positions=new Map<string,{x:number;y:number}>();
  for(const [col,nodes] of layers){
    nodes.forEach((n,row)=>positions.set(n.id,{
      x:PAD+col*(W+XGAP),
      y:PAD+(row+(rows-nodes.length)/2)*(H+YGAP),
    }));
  }
  return {positions,width:PAD*2+layers.size*W+Math.max(0,layers.size-1)*XGAP,
    height:PAD*2+rows*H+(rows-1)*YGAP};
}

export function TaskFlow({plan,onNodeClick}: {plan:TaskPlan;onNodeClick?:(id:string)=>void}) {
  const uid=useId().replace(/:/g,'');
  let diagram:ReturnType<typeof layout>;
  try { diagram=layout(plan); }
  catch(error){return <p className="tf-error" role="alert">{error instanceof Error?error.message:'无法生成流程图'}</p>;}
  if(!plan.nodes.length) return <p className="tf-empty">分析任务后，流程将在这里显示。</p>;
  const byId=new Map(plan.nodes.map(n=>[n.id,n]));
  const completed=plan.nodes.filter(n=>n.status==='completed').length;
  return <section className="task-flow" aria-label="任务流程">
    <header className="tf-heading"><span>任务流程</span><small>{completed} / {plan.nodes.length} 已完成</small></header>
    <div className="tf-scroll" tabIndex={0} aria-label="任务流程图，可横向滚动">
      <div className="tf-canvas" style={{width:diagram.width,height:diagram.height}}>
        <svg className="tf-lines" width={diagram.width} height={diagram.height} aria-hidden="true">
          <defs>
            <marker id={`${uid}-arrow`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="var(--muted-4)" /></marker>
            <marker id={`${uid}-lit`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="var(--accent)" /></marker>
          </defs>
          {plan.edges.map(e=>{
            const a=diagram.positions.get(e.from)!,b=diagram.positions.get(e.to)!;
            const x=a.x+W,y=a.y+H/2,x2=b.x,y2=b.y+H/2;
            const d=`M${x},${y} C${x+XGAP/2},${y} ${x2-XGAP/2},${y2} ${x2},${y2}`;
            const lit=isEdgeLit(byId.get(e.from)!.status,byId.get(e.to)!.status);
            return <path key={e.id} d={d} className={`tf-edge${lit?' is-lit':''}`} markerEnd={`url(#${uid}-${lit?'lit':'arrow'})`} />;
          })}
        </svg>
        {plan.nodes.map((n,i)=>{
          const p=diagram.positions.get(n.id)!;
          const content=<><span className="tf-step">{String(i+1).padStart(2,'0')}</span><span className="tf-node-text"><span className="tf-title">{n.title}</span><span className="tf-status">{labels[n.status]}</span></span><span className="tf-indicator" aria-hidden="true">{n.status==='completed'?'✓':n.status==='failed'?'!':''}</span></>;
          const cls=`tf-node is-${n.status}`;
          const style={left:p.x,top:p.y,width:W,height:H};
          const title=[n.title,labels[n.status],n.description].filter(Boolean).join(' · ');
          return onNodeClick ? <button type="button" key={n.id} className={cls} style={style} title={title} aria-label={title} onClick={()=>onNodeClick(n.id)}>{content}</button>
            : <div key={n.id} className={cls} style={style} title={title} aria-label={title}>{content}</div>;
        })}
      </div>
    </div>
    <p className="tf-legend">渐变填充：已完成 · 循环光环：执行中 · 无填充：待执行</p>
  </section>;
}
