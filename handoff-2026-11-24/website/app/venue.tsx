"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {appointment,changeVenue,initialVenue,liveRound,roundMs,roundStart,type VenueState} from "./venue-control";
import type {Meeting} from "./women-matching";
import "./venue.css";

type View={released?:string[];releaseRound?:number;title:string;start:string;revision:number;me?:string;admin:boolean;now:number;meetings:Meeting[];names:Record<string,string>;state:VenueState};
const roles=[["host","总主持人"],["l0","项目发起人"],["p0","共创伙伴"]];
function rehearsal():View {
  const now=Date.now(),names:Record<string,string>={},meetings:Meeting[]=[];
  for(let i=0;i<6;i++){names["l"+i]=["林宁","周晨","陈安","杨舟","方敏","夏禾"][i];names["p"+i]=["吴青","顾遥","唐悦","沈言","陆洋","何月"][i]}
  for(let n=1;n<=6;n++)for(let i=0;i<6;i++)meetings.push({round:n,room:i+1,lead:"l"+i,partner:"p"+((i+n-1)%6)});
  return {title:"组队日彩排",start:new Date(now-10*60000).toISOString(),revision:0,now,admin:true,meetings,names,state:initialVenue()};
}
const clock=(ms:number)=>new Date(ms).toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"});
const timer=(ms:number)=>{const sec=Math.max(0,Math.ceil(ms/1000));return Math.floor(sec/60)+":"+String(sec%60).padStart(2,"0")};
export default function Venue({id}:{id:string}){
  const demo=!id;
  const [view,setView]=useState<View|null>(()=>demo?rehearsal():null),[role,setRole]=useState("host");
  const [name,setName]=useState(""),[slide,setSlide]=useState(""),[notice,setNotice]=useState(""),[error,setError]=useState("");
  const [busy,setBusy]=useState(false),[tick,setTick]=useState(Date.now);
  const offset=useRef(0),generation=useRef(0),pending=useRef(false);
  const refresh=useCallback(async()=>{
    const seq=++generation.current;
    try{
      const r=await fetch("/api/women-program?view=venue&id="+encodeURIComponent(id),{cache:"no-store"});
      const data=await r.json() as View & {error?:string};if(seq!==generation.current)return;
      if(!r.ok){if([401,403,404].includes(r.status))setView(null);throw Error(data.error||"暂时无法读取会场。")}
      offset.current=data.now-Date.now();setView(data);setError("");
    }catch(e){if(seq===generation.current)setError(e instanceof Error?e.message:"连接中断。")}
  },[id]);
  useEffect(()=>{if(demo)return;void refresh();const t=setInterval(()=>{if(!document.hidden&&!pending.current)void refresh()},5000);return()=>{clearInterval(t);generation.current++}},[demo,refresh]);
  useEffect(()=>{const t=setInterval(()=>setTick(Date.now()),1000);return()=>clearInterval(t)},[]);
  const admin=demo?role==="host":!!view?.admin,me=demo?(admin?undefined:role):view?.me;
  const now=tick+offset.current,round=view?liveRound(view.start,now):0;
  async function act(command:string,text?:string){
    if(!view||pending.current)return;
    pending.current=true;setBusy(true);setNotice("");
    try{
      if(demo){
        const state=changeVenue({state:view.state,start:view.start,meetings:view.meetings,member:me,admin,now,action:command,text,round});
        setView({...view,state});
      }else{
        ++generation.current;
        const r=await fetch("/api/women-program",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"venue",id,revision:view.revision,data:{command,text,round:round||undefined}})});
        const d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error||"保存失败。");
      }
      setNotice("已更新。");
    }catch(e){setNotice(e instanceof Error?e.message:"保存失败。")}
    finally{if(!demo)await refresh();pending.current=false;setBusy(false)}
  }
  const back="#women/program"+(id?"?id="+encodeURIComponent(id):"");
  if(!view)return <article className="venue"><a href={back}>← 返回匹配场次</a><h1>组队日会场</h1><p role="status">{error||"正在读取本场排班…"}</p>{error&&<button onClick={refresh}>重新读取</button>}</article>;
  const {state,start,names}=view,closed=state.phase==="closed"||now>=Date.parse(start)+120*60000;
  const mine=view.meetings.filter(m=>admin||m.lead===me||m.partner===me),next=mine.find(m=>roundStart(start,m.round)>now);
  const current=mine.find(m=>m.round===round),checked=!!(me&&state.attendance[me]);
  const label=(key:string)=>state.attendance[key]||names[key];
  function presence(key:string){
    if(!state.attendance[key])return "待签到";
    if(state.phase!=="rooms"||!round)return "已签到";
    const done=demo?view!.meetings.some(m=>m.round===round&&(m.lead===key||m.partner===key)&&state.finished[appointment(m)]):view!.releaseRound===round&&view!.released?.includes(key);
    if(done)return "本轮已结束";
    return state.ready[key]===round?"本轮已进房":"本轮尚未进房";
  }
  function status(m:Meeting){
    if(state.finished[appointment(m)])return "双方会谈已结束";
    if(now>=roundStart(start,m.round)+roundMs)return "轮次时间已过";
    if(closed)return "会场已结束";
    if(state.phase==="presentation")return "等待总主持人开放分组";
    if(m.round!==round)return "待轮换 · "+(admin?[m.lead,m.partner].map(key=>label(key)+"："+presence(key)).join(" / "):"对方"+presence(m.lead===me?m.partner:m.lead));
    return [m.lead,m.partner].map(p=>label(p)+" · "+(state.ready[p]===round?"已到房间":state.attendance[p]?"已签到，尚未到房":"待签到")).join(" / ");
  }
  return <article className="venue">
    <a href={back}>← 返回匹配场次</a><h1>{view.title}</h1>
    {demo&&<fieldset><legend>单机彩排 · 虚构名单</legend><label>切换身份 <select value={role} onChange={e=>{setRole(e.target.value);setName("");setNotice("")}}>{roles.map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label><label>演练轮次 <select value={round||0} onChange={e=>{offset.current=roundStart(start,Number(e.target.value))-Date.now();setTick(Date.now())}}><option disabled value={0}>换场中</option>{[1,2,3,4,5,6].map(i=><option key={i} value={i}>第 {i} 轮</option>)}</select></label><button onClick={()=>{offset.current=0;setView(rehearsal());setRole("host");setName("");setSlide("");setNotice("");setTick(Date.now())}}>重新彩排</button></fieldset>}
    {error&&<p role="alert">状态同步中断 · {error} <button onClick={refresh}>重新连接</button></p>}
    <div className="venue-grid"><section className="venue-desk">
      <small>{admin?"总主持人":me&&label(me)} · {closed?"已结束":state.phase==="rooms"?"分组讨论":"全场讲解"}</small>
      <h2>{closed?"本场已结束":state.phase==="presentation"?"全场共享讲稿":round?"第 "+round+" 轮讨论":"等待下一轮"}</h2>
      {!closed&&(state.phase==="presentation"?<p className="venue-slide">{state.slide}</p>:<><p>{round?"本轮剩余 ":"下一轮 "+(next?clock(roundStart(start,next.round)):"暂无安排")}{round>0&&<b>{timer(roundStart(start,round)+roundMs-now)}</b>}</p>{!admin&&current&&<p>房间 {current.room} · {status(current)}</p>}</>)}
      <p>本页同步文字讲稿、签到和轮换状态。音视频尚未接入。</p>
      {!closed&&me&&!checked&&<form onSubmit={e=>{e.preventDefault();void act("checkin",name)}}><label>签到真实姓名<input required maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label><small>姓名由本人确认，供本场主持人与排定的会面对象查看。</small><button disabled={busy||!!error}>确认姓名并签到</button></form>}
      {checked&&<p>已签到 · {label(me!)}</p>}
      {!closed&&checked&&state.phase==="rooms"&&current&&!state.finished[appointment(current)]&&<><button disabled={busy||!!error||state.ready[me!]===round} onClick={()=>act("ready")}>确认已到房间 {current.room}</button>{me===current.lead&&state.ready[me]===round&&state.ready[current.partner]===round&&<button disabled={busy||!!error} onClick={()=>act("finish")}>结束本轮会谈</button>}</>}
      {admin&&!closed&&<fieldset disabled={busy||!!error}><legend>总主持控制</legend><label>发到所有房间的讲稿<textarea maxLength={800} value={slide} onChange={e=>setSlide(e.target.value)}/></label><button disabled={!slide.trim()} onClick={()=>act("slide",slide)}>更新共享讲稿</button><button onClick={()=>act(state.phase==="rooms"?"presentation":"rooms")}>{state.phase==="rooms"?"恢复全场讲解":"结束讲解，开放分组"}</button><button onClick={()=>{if(confirm("确认结束整场活动？"))void act("close")}}>结束整场活动</button></fieldset>}
      <p role="status">{notice}</p></section>
      <aside><h2>{admin?"全部房间":"我的六轮安排"}</h2>{[1,2,3,4,5,6].map(n=><div className="venue-round" aria-current={!closed&&n===round?"step":undefined} key={n}><b>第 {n} 轮 · {clock(roundStart(start,n))}</b>{mine.filter(m=>m.round===n).map(m=><div key={m.room}><strong>房间 {m.room} · {label(m.lead)} × {label(m.partner)}</strong><small>{status(m)}</small></div>)}{!mine.some(m=>m.round===n)&&<small>本轮空档</small>}</div>)}</aside></div></article>;
}
