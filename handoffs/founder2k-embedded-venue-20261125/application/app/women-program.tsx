"use client";
import {useEffect,useState,type FormEvent} from "react";
import {schedule,type Meeting,type Member} from "./women-matching";
import "./women-program.css";

type Card=Pick<Member,"id"|"name"|"topic"|"role"|"availability">;
type EventSummary={id:string;title:string;start:string;published:boolean};
type Detail=EventSummary & {admin:boolean;me?:string;revision:number;members:Card[];choices:string[];open:boolean;meetings:Meeting[];invites:{lead:string;partner:string;state:string}[];submitted:string[];teams:Record<string,string>;feedback:Record<string,string>};
const endpoint="/api/women-program";
const href=(id="")=>"#women/program"+(id?"?id="+encodeURIComponent(id):"");
const localTime=(date:string)=>new Date(date).toLocaleString("zh-CN",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit",timeZoneName:"short"});
const formValues=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();return Object.fromEntries(new FormData(e.currentTarget)) as Record<string,string>};
const phases=[
  ["找到搭档","用一张非保密项目卡写下问题、需要的能力和每周投入。在线见面后，双方决定是否试合作。"],
  ["验证问题","第一周带着三个用户访谈进入导师答疑，写下最值得验证的一条假设。"],
  ["一起交付","第二周可衔接七天创业快闪。开发者做一次可演示的试用，负责市场的成员记录真实反馈。"],
  ["找到下一步","第三周核对机构资格、公司设立和申请材料。第四周自愿路演，提出一个可跟进的请求。"],
];
async function read<T>(url:string,init?:RequestInit):Promise<T>{
  const r=await fetch(url,{cache:"no-store",...init});const d=await r.json();
  if(!r.ok)throw Error((d as {error?:string}).error||"暂时无法读取，请重试。");return d as T;
}
export default function WomenProgram({id}:{id:string}){
  const [sessions,setSessions]=useState<EventSummary[]>([]),[detail,setDetail]=useState<Detail|null>(null),[admin,setAdmin]=useState(false);
  const [notice,setNotice]=useState(""),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[version,reload]=useState(0);
  const [list,setList]=useState<string[]>([]),[open,setOpen]=useState(false),[preview,setPreview]=useState<Meeting[]|null>(null);
  useEffect(()=>{let live=true;setLoaded(false);setPreview(null);
    (id?read<Detail>(endpoint+"?id="+encodeURIComponent(id)).then(d=>{if(live){setDetail(d);setList(d.choices);setOpen(d.open);setAdmin(d.admin)}}):
      read<{admin:boolean;sessions:EventSummary[]}>(endpoint).then(d=>{if(live){setSessions(d.sessions);setDetail(null);setAdmin(d.admin)}}))
      .then(()=>{if(live)setLoaded(true)}).catch(e=>{if(live){setDetail(null);setNotice(e.message)}});return()=>{live=false};
  },[id,version]);
  async function act(action:string,data:Record<string,unknown>={}){
    if(busy)return;setBusy(true);setNotice("");
    try{
      const r=await read<{id:string;meetings?:Meeting[]}>(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,id:id||undefined,revision:detail?.revision,data})});
      if(action==="preview"){setPreview(r.meetings||[]);return}
      if(action==="create")location.hash=href(r.id);
      setNotice("已保存。");reload(v=>v+1);
    }catch(e){setNotice(e instanceof Error?e.message:"操作失败，请重试。")}finally{setBusy(false)}
  }
  const self=detail?.members.find(m=>m.id===detail.me),name=(id:string)=>detail?.members.find(m=>m.id===id)?.name||"成员";
  const locked=busy||!loaded, editable=detail&&!detail.published&&Date.parse(detail.start)>Date.now();
  function sheet(meetings:Meeting[]){
    return <div className="wp-rounds">{Array.from({length:6},(_,i)=><section key={i}><h4>第 {i+1} 轮 <small>{detail&&new Date(Date.parse(detail.start)+(10+i*17)*60000).toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})}</small></h4>
      {meetings.filter(m=>m.round===i+1).map(m=><p key={m.room}>{name(m.lead)} × {name(m.partner)} · {detail?.members.find(p=>p.id===m.lead)?.topic}</p>)}
      {!meetings.some(m=>m.round===i+1)&&<p>本轮空档</p>}</section>)}</div>
  }
  return <div className="wp"><a className="wp-back" href={id?href():"#women"}>‹ {id?"返回预孵化营":"女性共创"}</a>
    {!id&&<><div className="wp-hero"><div><h1>女性共创<br/>预孵化营</h1><p>你可以带来一个值得解决的问题，也可以带来一种别人正需要的能力。从一次见面，到一起完成第一次用户验证。</p><a className="hs-primary" href="#women/program" onClick={e=>{e.preventDefault();document.getElementById("wp-sessions")?.scrollIntoView({behavior:"smooth"})}}>查看匹配场次</a></div><img src="/herstartup/mission.webp" alt="共创伙伴在工作空间讨论项目"/></div>
    <section><h2>从认识到第一次交付</h2><p>四周试点方案 · 线上参加 · 拟免费、零股权。无需已有公司。支持包括课程、导师、伙伴和路演反馈。</p><div className="wp-grid">{phases.map(([title,body])=><article key={title}><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section className="wp-brief"><h2>匹配日怎么进行</h2><p>报名后可按顺序选择最多十位想见的人。项目方固定在一个房间，共创伙伴轮换。每场最多六轮，每轮十五分钟，双方可以留空档或约补谈。线上从活动页签到，个人议程会显示当前和下一位会面对象。</p><p>交谈时说清楚四件事：要解决的问题、本周能交付什么、能投入多少时间、下一次何时一起工作。接受邀请后才进入团队名单。</p></section></>}
    {notice&&<p role="status" className="hs-notice">{notice}</p>}
    {!id&&<section id="wp-sessions"><h2>匹配场次</h2>{loaded&&!sessions.length&&<p>首期场次筹备中。你可以先整理想验证的问题，或在女性共创寻找导师。</p>}
      {sessions.map(s=><a className="wp-event" key={s.id} href={href(s.id)}><b>{s.title}</b><span>{localTime(s.start)} · {s.published?"已排班":Date.parse(s.start)>Date.now()?"可查看报名":"已到场次时间"}</span></a>)}
      {admin&&<details><summary>运营 · 新建匹配场次</summary><form className="hs-form" onSubmit={e=>{const v=formValues(e);act("create",{title:v.title,start:new Date(v.start).toISOString()})}}><label>场次名称<input required name="title" maxLength={100}/></label><label>开始时间（本地时区）<input required type="datetime-local" name="start"/></label><button disabled={locked}>创建场次</button></form></details>}</section>}
    {id&&detail&&<section><h1>{detail.title}</h1><p>{localTime(detail.start)} · 120 分钟 · {detail.published?"已发布排班":"会前准备"}</p>
      {!self&&editable&&<form className="hs-form" onSubmit={e=>{const v=formValues(e);act("register",{...v,consent:v.consent==="on"})}}><h2>加入本场</h2><label>报名姓名（签到时确认）<input required name="name" maxLength={60}/></label><label>参与身份<select name="role"><option>项目发起人</option><option>共创伙伴</option></select></label><label>项目缺口或我能提供的能力<textarea required maxLength={400} name="topic"/></label><label>每周可投入的时间<input required maxLength={160} name="availability"/></label><label className="hs-check"><input required type="checkbox" name="consent"/>我能出席此场，并同意将以上内容展示给本场参与者与运营。</label><button disabled={locked}>报名本场</button></form>}
      {self&&<p>我的身份 · {self.name} / {self.role}</p>}
      {self&&editable&&<section><h2>我想和谁谈</h2><p>按点击顺序排序。移除后可以重新选择。双方已表达意愿的会面会优先考虑。</p><ol>{list.map((v,i)=><li key={v}>{name(v)} <button disabled={locked} onClick={()=>setList(list.filter((_,idx)=>i!==idx))}>移除</button></li>)}</ol>
        <div className="wp-grid">{detail.members.filter(m=>m.role!==self.role).map(m=><article key={m.id}><h3>{m.name}</h3><p>{m.topic}</p><small>{m.availability}</small><button disabled={locked||list.includes(m.id)||list.length>=10} onClick={()=>setList([...list,m.id])}>{list.includes(m.id)?"已选择":"加入志愿"}</button></article>)}</div>
        <label className="hs-check"><input type="checkbox" checked={open} onChange={e=>setOpen(e.target.checked)}/>愿意见本场志愿名单之外的伙伴</label><button disabled={locked} onClick={()=>act("rank",{choices:list,open})}>保存志愿</button></section>}
      {detail.admin&&!detail.published&&<section><h2>主持人排班</h2><p>每位项目方固定一间房。同轮不会重复占用成员或房间，已经见过的两人不会重复排入。</p><button disabled={locked} onClick={()=>act("preview")}>预览房间表</button>{preview&&<>{sheet(preview)}<p>待补约 · {detail.members.filter(m=>!preview.some(p=>p.lead===m.id||p.partner===m.id)).map(m=>m.name).join("、")||"无"}</p><button disabled={locked||!preview.length} onClick={()=>act("publish")}>确认并发布排班</button></>}</section>}
      {detail.published&&(self||detail.admin)&&<a className="hs-primary" href={"/venue?id="+encodeURIComponent(id)}>进入活动会场</a>}{detail.published&&(self||detail.admin)&&<section><h2>{detail.admin?"主持人原定排班":"我的原定排班"}</h2>{sheet(detail.meetings)}<p>请从上方进入会场并确认报名姓名。实际进度与调整后的时间见个人议程。</p></section>}
      {self&&detail.published&&<section><h2>会后组队</h2>
        {self.role==="项目发起人"&&!detail.teams[self.id]&&!detail.submitted.includes(self.id)&&<form className="hs-form" onSubmit={e=>{const v=formValues(e);act("invite",{partner:v.partner,talked:v.talked==="on"})}}><label>邀请共创伙伴<select name="partner" required defaultValue=""><option value="">选择已交谈的人</option>{detail.members.filter(m=>m.role==="共创伙伴"&&!detail.invites.some(i=>i.partner===m.id&&i.lead===self.id)).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label className="hs-check"><input required name="talked" type="checkbox"/>我们已沟通试合作任务和时间；名单获批后同意建立主站项目。</label><button disabled={locked}>邀请试合作</button></form>}
        {detail.invites.filter(i=>i.lead===self.id||i.partner===self.id).map(i=><article key={i.lead+i.partner} className="wp-event"><b>{name(i.lead)} × {name(i.partner)}</b><span>{{pending:"待对方回应",accepted:"已确认",declined:"已结束"}[i.state]}</span>{i.partner===self.id&&i.state==="pending"&&<div><button disabled={locked} onClick={()=>act("respond",{lead:i.lead,accept:true})}>同意加入，获批后进入主站团队</button><button disabled={locked} onClick={()=>act("respond",{lead:i.lead,accept:false})}>婉拒</button></div>}</article>)}
        {self.role==="项目发起人"&&detail.invites.some(i=>i.lead===self.id&&i.state==="accepted")&&!detail.teams[self.id]&&!detail.submitted.includes(self.id)&&<button disabled={locked} onClick={()=>act("submit")}>提交已确认名单，结束待回应邀请</button>}
        {detail.submitted.includes(self.id)&&<p>名单已送审。</p>}{detail.feedback[self.id]&&<p>运营反馈 · {detail.feedback[self.id]}</p>}
        {Object.keys(detail.teams).length>0&&<a className="hs-action" href="#teamspace">进入 Founder2K 团队工作台</a>}</section>}
      {detail.admin&&detail.submitted.map(lead=><form key={lead} className="hs-form" onSubmit={e=>{const v=formValues(e);act("review",{lead,reason:v.reason,approve:v.decision==="通过"})}}><h3>审核 {name(lead)} 的名单</h3><p>{detail.invites.filter(i=>i.lead===lead&&i.state==="accepted").map(i=>name(i.partner)).join("、")}</p><label>结果<select name="decision"><option>通过</option><option>退回补充</option></select></label><label>审核理由<input required maxLength={400} name="reason"/></label><button disabled={locked}>保存审核结果</button></form>)}
      {self&&detail.invites.filter(i=>i.state==="accepted"&&(i.lead===self.id||i.partner===self.id)&&!detail.teams[i.lead]).map(i=><button key={i.lead+i.partner} disabled={locked} onClick={()=>{if(confirm("将撤回这项试合作确认，并请负责人重新提交名单。"))act("release",{lead:i.lead,partner:i.partner})}}>撤回与{name(self.id===i.lead?i.partner:i.lead)}的组队确认</button>)}
      {self&&!Object.keys(detail.teams).length&&<button disabled={locked} onClick={()=>{if(confirm("退出会删除你的本场卡片、志愿和未确认会面。确认退出？"))act("withdraw")}}>退出本场</button>}
      </section>}
    {!id&&<details><summary>看一场房间轮换示例</summary><p>示例包含两个项目、三位伙伴。两位项目方各守一间房，伙伴只轮换到双方愿意见面的房间。</p><DemoRooms/></details>}
    <button className="wp-refresh" disabled={busy} onClick={()=>reload(v=>v+1)}>刷新场次信息</button>
    <section><h2>带着下一步继续</h2><div className="wp-links">{[["women/school","创业课程"],["women/mentors","预约导师交流"],["women/resources","女性创业机会"],["cohorts","主站创业快闪"],["teamspace","团队工作台"],["women/contact","联系运营与复核"]].map(([k,l])=><a key={k} href={"#"+k}>{l}</a>)}</div></section>
  </div>
}
function DemoRooms(){
  const names=["无障碍工具项目","社区服务项目","用户研究伙伴","开发伙伴","市场伙伴"];
  const choices=[["2","3"],["4","2"],["0","1"],["0"],["1"]];
  const members:Member[]=names.map((name,i)=>({id:String(i),name,role:i<2?"项目发起人":"共创伙伴",topic:"",availability:"",open:false,choices:choices[i]}));
  return <div className="wp-rounds">{schedule(members).map(m=><section key={m.round+"-"+m.room}><h4>第 {m.round} 轮 · 房间 {m.room}</h4><p>{names[Number(m.lead)]} × {names[Number(m.partner)]}</p></section>)}</div>;
}
