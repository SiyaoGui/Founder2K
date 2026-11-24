"use client";
import {useState} from "react";
import calendar from "./funding-calendar.json";
import {starterResources} from "./platform-content";
import "./resource-library.css";

type Milestone={start:string;end:string;kind:string;label:string;estimated:boolean};
export type Resource={id:string;title:string;type:string;region:string;stage:string;body:string;source:string;checked:string;deadline:string;organizer?:string;women?:boolean;facts?:string[][];dates?:Milestone[]};
type Props={women:boolean;query:string;extra:Resource[];saved:string[];projects:{id:string;title:string}[];ready:boolean;save:(id:string)=>Promise<boolean>;attach:(project:string,r:Resource,reason:string)=>Promise<boolean>};
const sources=new Set(calendar.map(r=>r.id));
const core:Resource[]=[...calendar,...starterResources.filter(r=>!sources.has(r.id))];
const pageSize=12;
function calendarDate(){return new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Copenhagen",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function ResourceCard({r,saved,ready,projects,save,attach,detailUrl,full=false}:{r:Resource;saved:boolean;ready:boolean;projects:Props["projects"];save:Props["save"];attach:Props["attach"];detailUrl:string;full?:boolean}){
 const [select,setSelect]=useState(false);
 return <article className="fund-card"><div className="fund-meta">{r.type} · {r.region}</div><h3><a href={detailUrl}>{r.title}</a></h3>
 <p>{r.body}</p>{full&&<><dl><dt>资格线索</dt><dd>{r.stage||"依当期条件"}</dd>{r.organizer&&<><dt>原卡机构或地点</dt><dd>{r.organizer}</dd></>}{r.facts?.map(([k,v])=><div className="fund-pair" key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>{!!r.dates?.length&&<><h4>日历节点</h4><ul>{r.dates.map((d,i)=><li key={i}>{d.start}{d.end!==d.start&&" 至 "+d.end} · {d.kind} · {d.label}{d.estimated&&"（原卡预计）"}</li>)}</ul></>}{r.deadline&&<p>运营登记截止日 · {r.deadline}</p>}<p className="fund-muted">{r.checked?"来源核对记录 "+r.checked:"资料来自原日历，当期资格、金额与窗口待核对。"}</p></>}
 <div className="fund-actions">{!full&&<a href={detailUrl}>查看条件与日期</a>}{full&&(r.source?<a href={r.source} rel="noreferrer" target="_blank">查看来源页面</a>:<span>原卡缺少可用来源链接</span>)}<button disabled={!ready||saved} onClick={()=>save(r.id)}>{saved?"已收藏":"收藏资源"}</button></div>
 {full&&<div className="fund-next"><h4>把这个机会用于项目</h4>{projects.length?<button onClick={()=>setSelect(!select)} aria-expanded={select}>记录到团队工作台</button>:<a href="#teamspace">进入工作台建立项目</a>}{select&&<form onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const values=new FormData(form);if(await attach(String(values.get("project")),r,String(values.get("reason"))))setSelect(false)}}><label>项目<select name="project">{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label><label>本团队还缺哪份证据或申请材料？<textarea required name="reason" maxLength={1200}/></label><button disabled={!ready}>保存给项目成员</button></form>}<a href="#women/community">找同伴复核申请材料</a></div>}</article>
}
export default function ResourceLibrary(props:Props){
 const {women,query,extra,ready,save,projects,attach}=props;
 const [q,setQ]=useState(""),[kind,setKind]=useState("全部"),[region,setRegion]=useState("全部"),[stage,setStage]=useState("全部"),[mode,setMode]=useState("目录"),[month,setMonth]=useState("全部"),[page,setPage]=useState(1);
 const [when,setWhen]=useState("尚未结束"); const today=calendarDate();
 const entries=[...core,...extra].filter(r=>!women||r.women);
 const matches=entries.filter(r=>(kind==="全部"||kind===r.type)&&(region==="全部"||region===r.region)&&(stage==="全部"||stage===r.stage)&&[r.title,r.body,r.organizer,r.region,r.type,...(r.facts||[]).flat()].join(" ").toLowerCase().includes(q.trim().toLowerCase()));
 const history=matches.flatMap(r=>[...(r.dates||[]),...(r.deadline?[{start:r.deadline,end:r.deadline,kind:"截止",label:"运营登记",estimated:false}]:[])].map(d=>({r,d}))).sort((a,b)=>a.d.start.localeCompare(b.d.start));
 const events=history.filter(({d})=>(month==="全部"||(d.start.slice(0,7)<=month&&d.end.slice(0,7)>=month))&&(when==="全部"||(when==="尚未结束"?d.end>=today:d.end<today)));
 const total=mode==="目录"?matches.length:events.length;const pages=Math.max(1,Math.ceil(total/pageSize));const current=Math.min(page,pages),start=(current-1)*pageSize;
 const root=women?"#women/resources":"#opportunities";const id=new URLSearchParams(query).get("id");const url=(i:string)=>root+"?id="+encodeURIComponent(i);
 function input(label:string,value:string,values:string[],change:(v:string)=>void){return <label>{label}<select aria-label={label} value={value} onChange={e=>{change(e.target.value);setPage(1)}}>{["全部",...new Set(values)].map(x=><option key={x}>{x}</option>)}</select></label>}
 function card(r:Resource,full=false){return <ResourceCard key={r.id} r={r} full={full} detailUrl={url(r.id)} saved={props.saved.includes(r.id)} ready={ready} projects={projects} save={save} attach={attach}/>}
 if(id){const r=entries.find(i=>i.id===id);return <section className="fund-library"><a href={root}>返回资源目录</a><h1>机会详情</h1>{r?card(r,true):<p>未找到此资源。</p>}</section>}
 return <section className="fund-library"><div className="fund-heading"><div><h1>{women?"女性创业机会":"创业资源图书馆"}</h1><p className="fund-lead">{women?"从项目对女性创始人的支持出发，再核对地区、公司阶段和申请条件。":"按支持类型、所在地和申请条件找到机会，把下一份要准备的材料记进团队项目。"}</p><div className="fund-cross"><a href={women?"#opportunities":"#women/resources"}>{women?"浏览 Founder2K 全部资源":"女性创业机会"}</a><a href="#cohorts">进入创业快闪</a><a href="#teamspace">查看项目与收藏</a></div></div><p className="fund-inventory"><strong>{entries.length}</strong><span>条收录资料</span></p></div>
 <p className="fund-muted">收录资料包含历史场次和预计窗口。票价、条款与资格按收录时记录，申请前请核对当期来源。</p>
 <div className="fund-tabs">{["目录","融资日历"].map(x=><button key={x} aria-pressed={mode===x} onClick={()=>{setMode(x);setPage(1)}}>{x}</button>)}</div><div className="fund-filters"><label>搜索机会<input aria-label="搜索机会" placeholder="项目、主办机构或关键词" type="search" value={q} onChange={e=>{setQ(e.target.value);setPage(1)}}/></label>{input("机会类型",kind,entries.map(r=>r.type),setKind)}{input("资源地区",region,entries.map(r=>r.region),setRegion)}{input("资格或阶段",stage,entries.map(r=>r.stage).filter(Boolean),setStage)}</div>
 {mode==="融资日历"&&<><p>日期按原日历记录。预计窗口单独标记，历史场次可回查。申请前请打开来源确认。</p><div className="fund-filters">{input("月份",month,history.flatMap(({d})=>{const out=[];let m=d.start.slice(0,7);while(m<=d.end.slice(0,7)&&out.length<120){out.push(m);const [y,n]=m.split("-").map(Number);m=new Date(Date.UTC(y,n,1)).toISOString().slice(0,7)}return out}),setMonth)}{input("时间范围",when,["尚未结束","已结束"],setWhen)}</div></>}
 <p className="fund-count" aria-live="polite">{total} {mode==="目录"?"条资料":"个日历节点"} · 第 {current} / {pages} 页</p>
 {mode==="目录"?<div className="fund-grid">{matches.slice(start,start+pageSize).map(r=>card(r))}</div>:<div>{events.slice(start,start+pageSize).map(({r,d},i)=><a className="fund-date" key={r.id+d.start+i} href={url(r.id)}><time>{d.start}{d.end!==d.start&&" 至 "+d.end}</time><div><strong>{r.title}</strong><small>{d.kind} · {d.label}{d.estimated&&"（原卡预计）"}</small></div></a>)}</div>}
 {!total&&<div className="fund-empty"><p>{mode==="目录"?"没有资料符合当前筛选条件。":"当前条件下没有日历节点。"}</p><button onClick={()=>{setQ("");setKind("全部");setRegion("全部");setStage("全部");setMonth("全部");setWhen("全部");setPage(1)}}>清除筛选条件</button></div>}{pages>1&&<div className="fund-paging"><button disabled={current===1} onClick={()=>setPage(current-1)}>上一页</button><span>{current} / {pages}</span><button disabled={current===pages} onClick={()=>setPage(current+1)}>下一页</button></div>}</section>
}
