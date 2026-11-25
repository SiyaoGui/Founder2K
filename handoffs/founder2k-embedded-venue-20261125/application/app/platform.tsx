"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {JourneyGuide} from "./journeys";
import ResourceLibrary, {type Resource} from "./resource-library";
import { starterLessons } from "./platform-content";
import { ArrowUpRight, BookOpen, CalendarDays, ClipboardList, Compass, Flag, MessageSquare, Users } from "lucide-react";

type Entry = { id:string;kind:string;parent:string;status:string;data:Record<string,any>;updated:number;owner?:string };
type PlatformData = { admin:boolean;userId:string;catalog:Entry[];mine:Entry[];teams:Entry[];operations:Entry[];connections:Entry[];votes:{ballot:string;choice:string}[] };
const empty:PlatformData = {admin:false,userId:"",catalog:[],mine:[],teams:[],operations:[],connections:[],votes:[]};
const tracks = ["AI 服务","非 AI 创业","生物与 AI","AI 与硬件","女性共创"];
const channels = ["找共创","求反馈","分享进展","女性共创"];
const stages = ["问题","访谈","范围","原型","试用","市场","复盘"];
const states:Record<string,string> = {draft:"草稿",open:"开放报名",closed:"报名已关闭",submitted:"待审核",needs_info:"待补充",waitlist:"候补",admitted:"已录取",declined:"未通过",pending:"待回应",accepted:"已接受",listed:"已展示",hidden:"已隐藏",voting:"表决中",approved:"已通过",resolved:"已处理",saved:"已提交",completed:"已完成"};
const features = [
  {route:"cohorts",title:"场次与报名",copy:"找一场活动，核对时间、资格和交付要求。",Icon:CalendarDays},
  {route:"people",title:"寻找共创者",copy:"按兴趣与能力查看自愿公开的成员资料。",Icon:Users},
  {route:"school",title:"创业学校",copy:"沿项目阶段做练习，从问题到用户测试。",Icon:BookOpen},
  {route:"community",title:"项目讨论区",copy:"发起合作、请求反馈或记录进展。",Icon:MessageSquare},
  {route:"teamspace",title:"项目工作台",copy:"组队、提交成果、追踪报名与展厅状态。",Icon:ClipboardList},
  {route:"decisions",title:"项目接续与表决",copy:"核对 Callback 申请、表决和进展。",Icon:Flag},
  {route:"opportunities",title:"创业资源",copy:"按地区、阶段与类型查找官方机会。",Icon:Compass},
];


function Intro({title,children}:{title:string;children:ReactNode}) {
  return <div className="pageintro"><h1>{title}</h1><p>{children}</p></div>;
}
function Field({name,label,value,type="text",required=true,area=false,min,max}:{name:string;label:string;value?:string|number;type?:string;required?:boolean;area?:boolean;min?:number;max?:number}){
  return <label>{label}{area?<textarea name={name} defaultValue={value} required={required} maxLength={8000}/>:<input name={name} defaultValue={value} type={type} required={required} maxLength={1200} min={min??(type==="number"?1:undefined)} max={max}/>}</label>;
}
function Select({name,label,choices,value}:{name:string;label:string;choices:readonly (string|{key:string;text:string})[];value?:string}){
  return <label>{label}<select aria-label={label} name={name} defaultValue={value}>{choices.map(c=>typeof c==="string"?<option key={c}>{c}</option>:<option key={c.key} value={c.key}>{c.text}</option>)}</select></label>;
}
function Status({value}:{value:string}){return <span className="platform-status">{states[value]||value}</span>}
function Cover({title,children}:{title:string;children:ReactNode}){return <article className="panel platform-panel"><h3>{title}</h3>{children}</article>}
function SafeLink({value,label="查看来源"}:{value?:string;label?:string}){
  return value?.startsWith("https://")?<a className="textlink" href={value} target="_blank" rel="noreferrer">{label}<ArrowUpRight size={16}/></a>:null;
}
const pick = (entries:Entry[],kind:string)=>entries.filter(e=>e.kind===kind);

export default function Platform({page,routeQuery=""}:{page:string;routeQuery?:string}){
  const [model,setModel]=useState(empty),[status,setStatus]=useState("loading"),[notice,setNotice]=useState(""),[sending,setSending]=useState(false);
  const [search,setSearch]=useState(""),[filter,setFilter]=useState("全部");
  const [selected,setSelected]=useState("");

  const query=new URLSearchParams(routeQuery);
  const [seat,setSeat]=useState("参与者");
  const [cycle,setCycle]=useState("全部");
  const task=query.get("task");
  useEffect(()=>{const params=new URLSearchParams(routeQuery);setSeat(params.get("seat")==="observer"?"旁听":"参与者");setCycle(params.get("cycle")||"全部");setSearch("");setFilter(params.get("filter")||"全部");setSelected("");setNotice("");},[page,routeQuery]);
  useEffect(()=>{load()},[]);
  async function load(){
    try{
      const r=await fetch("/api/platform", {cache:"no-store"});
      if(r.ok){setModel(await r.json() as PlatformData);setStatus("ready");return true}
      setStatus(r.status===401?"login":"error");return false;
    }catch{setStatus("error");return false}
  }
  async function act(action:string,data:Record<string,unknown>,success="已保存。"){
    if(sending)return false;
    setSending(true);setNotice("");
    try{
      const r=await fetch("/api/platform",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,data})});
      const parsed=await r.json() as {error?:string;fields?:Record<string,string[]>};
      if(!r.ok)throw new Error(parsed.error||"操作失败");
      setNotice(await load()?success:"操作已保存，列表更新暂时失败。请重新读取。");
      return true;
    }catch(e){setNotice(e instanceof Error?e.message:"网络异常。请稍后重试。");return false}
    finally{setSending(false)}
  }
  function submit(action:string, fixed:Record<string,unknown>={},success?:string,reset=true){
    return async(e:FormEvent<HTMLFormElement>)=>{
      e.preventDefault();
      const form=e.currentTarget;
      const values:Record<string,unknown>=Object.fromEntries(new FormData(form));
      if(form.elements.namedItem("problemScore")){
        const points=[values.problemScore,values.prototypeScore,values.learningScore,values.collaborationScore];
        if(points.some(x=>x!=="")){
          if(points.some(x=>x==="")){setNotice("请填完四项评分，或全部留空。");return}
          values.scores={problem:points[0],prototype:points[1],learning:points[2],collaboration:points[3]};
        }
      }
      for(const k of ["consent","permission","listed","acceptsContact","paidAI"]) if(form.elements.namedItem(k)) values[k]=values[k]==="on";
      if(await act(action,{...values,...fixed},success)&&reset) form.reset();
    };
  }
  const btn=(label:string)=><button className="btn primary" disabled={sending||status!=="ready"}>{sending?"处理中…":label}</button>;
  const signIn=<a className="btn primary" href={"/signin-with-chatgpt?return_to="+encodeURIComponent("/#"+page)} target="_top">登录账户</a>;
  const kinds=(kind:string)=>pick(model.catalog,kind);
  const my=(kind:string)=>pick(model.mine,kind);
  const ops=(kind:string)=>pick(model.operations,kind);
  const work=pick(model.teams,"team");
  const cohortList=kinds("cohort");
  const visibleCohorts=cohortList.filter(c=>cycle==="全部"||c.data.cycle===cycle);
  const profile=my("profile")[0];
  const currentCohort=cohortList.find(c=>c.id===(selected||new URLSearchParams(routeQuery).get("id")));
  const project=work.find(t=>t.id===selected)||work[0];
  const applications=my("application");
  const emptyState=(txt:string)=><div className="empty platform-empty">{txt}</div>;
  const inbox=(entries:Entry[],title:string)=>entries.length>0&&<div className="platform-inbox"><h2>{title}</h2>{entries.map(i=><div key={i.id} className="recordrow"><div><strong>{i.data.title||i.data.cohortTitle||i.data.projectTitle||"记录"}</strong>{i.data.reason&&<p>{i.data.reason}</p>}{typeof i.data.scoreTotal==="number"&&<p>评审得分 {i.data.scoreTotal} / 100</p>}{i.kind==="savedResource"&&<a className="textlink" href={"#opportunities?id="+encodeURIComponent(i.parent)}>查看资源详情</a>}</div><Status value={i.status}/></div>)}</div>;
  const profileForm=<form className="panel" key={profile?.updated||"new-profile"} onSubmit={submit("profile",{},"资料已更新。",false)}>
    <h3>我的成员资料</h3><Field name="name" label="展示名字" value={profile?.data.name}/><Select name="role" label="参与方式" choices={["创业者","共创者","导师","投资人"]} value={profile?.data.role}/><Field name="skills" label="领域与能力" value={profile?.data.skills}/><Field name="timezone" label="城市或时区" value={profile?.data.timezone}/><Field name="bio" label="你希望找到怎样的协作？" area value={profile?.data.bio}/><Field name="link" label="作品或专业档案链接（选填）" type="url" value={profile?.data.link} required={false}/><label className="check"><input name="listed" type="checkbox" defaultChecked={profile?.status==="listed"}/>在成员目录展示以上字段</label><label className="check"><input name="acceptsContact" type="checkbox" defaultChecked={profile?.data.acceptsContact===true}/>自愿接收带具体问题的站内联系请求</label>{btn("保存成员资料")}
  </form>;
  function cohortForm(row?:Entry){
    return <form className="panel" onSubmit={submit("cohort",row?{id:row.id}:{},"活动场次已保存。",!row)}>
      <h3>{row?"编辑场次":"新增活动场次"}</h3>
      <Select name="venueFormat" label="会场形式" choices={["创业快闪","导师答疑","路演"]} value={row?.data.venueFormat}/><Select name="cycle" label="工具周期" choices={[{key:"unspecified",text:"按本场资格说明"},{key:"AI",text:"AI 周期（正式参与者需付费会员）"},{key:"非AI",text:"非 AI 周期（无需会员）"}]} value={row?.data.cycle}/><Field name="title" label="场次名称" value={row?.data.title}/><div className="formrow"><Select name="track" label="方向" choices={tracks} value={row?.data.track}/><Select name="format" label="形式" choices={["线上","线下","混合"]} value={row?.data.format}/></div>
      <div className="formrow"><Field name="start" type="date" label="开始日期" value={row?.data.start}/><Field name="end" type="date" label="结束日期" value={row?.data.end}/></div>
      <div className="formrow"><Field name="location" label="地点或时区" value={row?.data.location}/><Field name="audienceSeats" type="number" label="路演观众名额（仅路演，最多 500）" value={row?.data.audienceSeats??0}/><Field name="seats" label="参与者名额" type="number" value={row?.data.seats||10}/></div>
      <Field name="requirements" label="资格、工具与可投入时间" area value={row?.data.requirements}/><Field name="outcome" label="交付和支持范围" area value={row?.data.outcome}/>
      <Select name="stage" label="报名状态" choices={[{key:"draft",text:"保存草稿"},{key:"open",text:"对当前站点受众开放报名"},{key:"closed",text:"关闭报名"}]} value={row?.status}/>{btn("保存场次")}
    </form>;
  }
  return <div className="platform">
  {notice&&<div className="notice" role="status">{notice}<button onClick={()=>setNotice("")} aria-label="关闭提示">×</button></div>}
  {status==="error"&&<div className="callout">数据暂时无法读取。<button onClick={load}>重新读取</button></div>}
  {status==="login"&&<div className="callout">登录后使用报名、组队与协作功能。 {signIn}</div>}
  {status==="loading"&&<p className="platform-loading" role="status">正在读取活动与项目…</p>}
  {page==="hub"&&<><Intro title="创业平台">查看活动、找同伴，把成果交给真实用户测试。</Intro><JourneyGuide/><div className="platform-directory">{features.map(({route,title,copy,Icon})=><a className="panel platform-feature" key={route} href={"#"+route}><Icon size={26}/><h3>{title}</h3><p>{copy}</p><ArrowUpRight size={20}/></a>)}{model.admin&&<a className="panel platform-feature" href="#operations"><ClipboardList/><h3>运营后台</h3><p>管理场次、审核、资源与评审。</p><ArrowUpRight size={20}/></a>}</div></>}
  {page==="cohorts"&&<><Intro title="创业快闪报名">活动开放后可查看场次、名额、参与条件以及实际要带走的成果。</Intro>
    <label className="filterbar">筛选工具周期<select value={cycle} onChange={e=>{setCycle(e.target.value);setSelected("")}}>{["全部","AI","非AI"].map(v=><option key={v} value={v}>{v==="全部"?"所有周期":v+" 周期"}</option>)}</select></label>{visibleCohorts.length===0&&status==="ready"&&<div className="empty">当前筛选下暂无场次。 <a href="#how">查看七天安排</a></div>}
    <div className="platform-directory">{visibleCohorts.map(c=><Cover key={c.id} title={c.data.title}><Status value={c.status}/><p>{c.data.start} – {c.data.end}<br/>{c.data.format} · {c.data.location} · {c.data.seats} 个参与者名额</p><p>{c.data.cycle==="AI"?"AI 周期 · 需付费 AI 会员":c.data.cycle==="非AI"?"非 AI 周期 · 无需会员":"工具按本场说明"} · 旁听最多 {c.data.venueFormat==="路演"?Number(c.data.audienceSeats||0):Math.min(2,Math.floor(c.data.seats/3))} 人</p><p>{c.data.outcome}</p><a className="textlink" href={"#cohorts?"+new URLSearchParams({id:c.id,cycle,seat:seat==="旁听"?"observer":"participant"})} onClick={()=>setSelected(c.id)}>查看场次与申请 <ArrowUpRight size={17}/></a></Cover>)}</div>
    {currentCohort&&visibleCohorts.includes(currentCohort)&&<div className="twocol platform-columns" key={currentCohort.id}><div><h2>{currentCohort.data.title}</h2><p>{currentCohort.data.requirements}</p>{(model.admin||applications.some(a=>a.parent===currentCohort.id&&a.status==="admitted"))&&<a href={"/venue?id="+encodeURIComponent(currentCohort.id)}>进入活动会场</a>}<p>{currentCohort.data.venueFormat==="路演"?"本场观众名额 "+(currentCohort.data.audienceSeats||0):"旁听上限取两人和参与者名额的三分之一中较小的值。"}旁听身份无投票权。</p>{inbox(applications.filter(a=>a.parent===currentCohort.id),"本期申请")}</div>
      {currentCohort.status==="open"&&(!applications.some(a=>a.parent===currentCohort.id&&a.status!=="needs_info"))&&<form className="panel" onSubmit={submit("apply",{cohortId:currentCohort.id},"申请已提交。可在项目工作台查看审核状态。")}><h3>提交本期申请</h3><div className="formrow"><Field name="name" label="报名姓名（签到时确认）"/><Field name="email" label="联系邮箱" type="email"/></div><div className="formrow"><Field name="hours" label="每周可投入小时" type="number"/><label>参与方式<select aria-label="参与方式" name="role" value={seat} onChange={e=>setSeat(e.target.value)}><option>参与者</option><option>旁听</option></select></label></div>{currentCohort.data.cycle==="AI"&&seat==="参与者"&&<label className="check"><input type="checkbox" name="paidAI" required/>我有至少一个可用于本期任务的付费 AI 会员</label>}<Field name="skills" label="可贡献的能力"/><Field name="goal" label="你想验证的问题" area/><Field name="profile" label="作品或 LinkedIn 链接（选填）" type="url" required={false}/><label className="check"><input type="checkbox" name="consent" required/>同意将申请信息交给本期运营审核，知悉可通过支持入口提出复核。</label><a href="#privacy">查看资料说明</a>{btn("提交申请")}</form>}
    </div>}
    {inbox(applications,"我的申请")}
  </>}
  {page==="people"&&<><Intro title="寻找共创者">浏览成员主动公开的能力、地区与合作方向。角色由成员自行填写。</Intro>
    <div className="twocol platform-columns"><div><div className="filterbar"><input aria-label="搜索成员" placeholder="姓名、技能或时区" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="成员角色" value={filter} onChange={e=>setFilter(e.target.value)}>{["全部","创业者","共创者","导师","投资人"].map(v=><option key={v}>{v}</option>)}</select></div>
    {kinds("profile").filter(x=>(filter==="全部"||x.data.role===filter)&&[x.data.name,x.data.skills,x.data.timezone].join(" ").toLowerCase().includes(search.toLowerCase())).map(person=><Cover key={person.id} title={person.data.name}><span className="tag">{person.data.role} · {person.data.timezone}</span><p>{person.data.skills}</p><p>{person.data.bio}</p><SafeLink value={person.data.link} label="查看自愿提供的资料"/>{person.id!==profile?.id&&person.data.acceptsContact===true&&<details><summary>发起具体联系</summary><form onSubmit={submit("connect",{profileId:person.id},"联系请求已提交。可在工作台查看结果。") }><Select name="purpose" label="联系主题" choices={["寻找共创","导师问答","投资沟通"]}/><Field name="question" label="请说明想讨论什么，以及目前已有的进展" area/>{btn("发站内联系请求")}</form></details>}{person.id!==profile?.id&&work.some(t=>t.owner===model.userId)&&<form onSubmit={submit("invite",{profileId:person.id},"邀请已保存。对方可在工作台回应。")}><Select name="projectId" label="邀请加入" choices={work.filter(t=>t.owner===model.userId).map(t=>({key:t.id,text:t.data.title}))}/>{btn("发站内邀请")}</form>}</Cover>)}
    {!kinds("profile").some(x=>(filter==="全部"||x.data.role===filter)&&[x.data.name,x.data.skills,x.data.timezone].join(" ").toLowerCase().includes(search.toLowerCase()))&&emptyState("没有符合条件的成员。可以调整筛选，或先填写自己的档案。")}</div>{profileForm}</div>
  </>}
  {page==="school"&&<><Intro title="创业学校">把学习拆成可提交的项目任务。打开一课，完成练习并将成果写进工作台。</Intro>
    <div className="platform-directory">{starterLessons.map(l=><Cover title={l.title} key={l.id}><span className="tag">{l.phase}</span><p>{l.body}</p><details><summary>查看练习</summary><p>{l.exercise}</p><a className="textlink" href="#teamspace">记录成果</a></details><div className="platform-controls"><button className="btn primary" disabled={sending||status!=="ready"||my("learn").some(x=>x.parent===l.id)} onClick={()=>act("learn",{id:l.id})}>{my("learn").some(x=>x.parent===l.id)?"已完成":"记录课程完成"}</button></div></Cover>)}
    {kinds("lesson").map(l=><Cover title={l.data.title} key={l.id}><span className="tag">{l.data.track}</span><p className="platform-body">{l.data.body}</p><details><summary>实践任务</summary><p>{l.data.exercise}</p></details><SafeLink value={l.data.source}/><div className="platform-controls"><button className="btn primary" disabled={sending||status!=="ready"||my("learn").some(x=>x.parent===l.id)} onClick={()=>act("learn",{id:l.id})}>{my("learn").some(x=>x.parent===l.id)?"已完成":"记录课程完成"}</button></div></Cover>)}</div>
  </>}
  {page==="community"&&<><Intro title="项目讨论区">选择与你的问题相关的讨论。公开资料只面向站点当前有权访问的成员。</Intro><div className="twocol platform-columns"><div><div className="filterbar"><select aria-label="讨论分类" value={filter} onChange={e=>setFilter(e.target.value)}>{["全部",...channels].map(x=><option key={x}>{x}</option>)}</select></div>
  {kinds("post").filter(p=>filter==="全部"||p.data.channel===filter).map(p=><Cover title={p.data.title} key={p.id}><span className="tag">{p.data.channel} · {p.data.author}</span><p className="platform-body">{p.data.body}</p><details><summary>回复（{kinds("reply").filter(r=>r.parent===p.id).length}）</summary>{kinds("reply").filter(r=>r.parent===p.id).map(r=><div key={r.id} className="platform-reply"><strong>{r.data.author}</strong><p>{r.data.body}</p></div>)}<form onSubmit={submit("post",{postId:p.id},"回复已发布。")}><Field name="body" label="回复内容" area/>{btn("发布回复")}</form></details></Cover>)}{!kinds("post").some(p=>filter==="全部"||p.data.channel===filter)&&emptyState("还没有讨论。你可以发起一个具体的合作问题。")}</div>
    <form className="panel" onSubmit={submit("post",{},"讨论已发布。")}><h3>发起讨论</h3><Select name="channel" label="讨论分类" choices={channels}/><Field name="title" label="标题"/><Field name="body" label="说清楚问题、你已尝试的事和希望得到的帮助" area/>{btn("发布讨论")}<a href="#principles">阅读社区规则</a></form></div></>}
  {page==="teamspace"&&<><Intro title="项目工作台">创建协作项目、回应邀请、记录各阶段成果和申请展示。</Intro>
    <div className="platform-controls"><a href="#opportunities">查找下一步资源</a><a href="#workspace">个人草稿箱</a><a href="#teamspace?task=sales">销售记录</a><a href="#teamspace?task=build">开发记录</a><a href="#projects">项目展厅</a></div>{inbox(applications,"我的报名")}{inbox(my("connection"),"我发出的联系请求")}{model.connections.length>0&&<div className="platform-inbox"><h2>收到的联系请求</h2>{model.connections.map(c=><Cover title={c.data.title} key={c.id}><Status value={c.status}/><p>{c.data.from}：{c.data.question}</p>{c.status==="pending"&&<form onSubmit={submit("connection",{id:c.id},"已保存回复。") }><Select name="decision" label="处理方式" choices={[{key:"accepted",text:"愿意沟通"},{key:"declined",text:"暂不沟通"}]}/><Field name="reply" label="回复或约定下一步（选填）" required={false} area/>{btn("保存回复")}</form>}</Cover>)}</div>}
    {my("invite").length>0&&<div className="platform-inbox"><h2>收到的邀请</h2>{my("invite").map(i=><div className="recordrow" key={i.id}><strong>{i.data.projectTitle}</strong><div className="platform-controls"><Status value={i.status}/>{i.status==="pending"&&<><button className="subtle" disabled={sending} onClick={()=>act("invitation",{id:i.id,decision:"accepted"})}>接受</button><button className="subtle" disabled={sending} onClick={()=>act("invitation",{id:i.id,decision:"declined"})}>拒绝</button></>}</div></div>)}</div>}
    <div className="twocol platform-columns"><div><h2>我的协作项目</h2><div className="filterbar">{work.map(t=><button key={t.id} className={t.id===project?.id?"selected":""} onClick={()=>setSelected(t.id)}>{t.data.title}</button>)}</div>
    {project?<div key={project.id}><Cover title={project.data.title}><p>{project.data.problem}</p><span className="tag">{project.data.track} · {project.owner===model.userId?"负责人":"协作者"}</span><a className="textlink" href="#people">寻找共创者 <ArrowUpRight size={16}/></a></Cover>
      <div className="platform-inbox"><h3>团队成果</h3><details><summary>开场问题与成果提示</summary><ol><li>讲一个用户上次实际遇到的问题。</li><li>说明本周能贡献什么，哪些任务仍无人负责。</li><li>写一项可推翻当前判断的测试。</li><li>确认成果署名、公开范围与跨项目使用权。</li></ol></details>{pick(model.teams,"evidence").filter(e=>e.parent===project.id).map(e=><div className="recordrow" key={e.id}><div><strong>{e.data.stage} · {e.data.title}</strong><p className="platform-body">{e.data.body}</p><SafeLink value={e.data.link} label="打开成果"/></div></div>)}</div>
      <form className="panel" onSubmit={submit("evidence",{projectId:project.id},"成果已向项目成员保存。")}><h3>记录一次进展</h3><Select name="stage" label="所属阶段" choices={stages} value={task==="sales"?"市场":task==="build"?"原型":undefined}/><Field name="title" label="成果标题"/>{task==="sales"?<label>市场测试记录<textarea name="body" required maxLength={2400} placeholder={"渠道与归因依据\n意向数、订单数与到账币种\n退款、成本和分配约定\n观察与下一步"}/></label>:task==="build"?<label>原型测试记录<textarea name="body" required maxLength={2400} placeholder={"版本与环境\n复现步骤及预期结果\n实际观察与失败条件\n交接人与下一步"}/></label>:<Field name="body" label="证据、结果与下一步" area/>}<Field name="link" label="成果链接（选填）" required={false} type="url"/>{btn("提交团队成果")}</form>
      {project.owner===model.userId&&<details className="panel"><summary>申请进入项目展厅</summary><form onSubmit={submit("showcase",{projectId:project.id,track:project.data.track},"展示申请已送审。")}><Field name="title" label="展厅名称" value={project.data.title}/><Field name="body" label="可公开的项目介绍、成果与需求" area/><Field name="validation" label="已经验证了什么（可公开，选填）" area required={false}/><Field name="need" label="希望导师或投资者协助什么（可公开，选填）" area required={false}/><Field name="link" label="公开演示链接（选填）" required={false} type="url"/><label className="check"><input type="checkbox" name="permission" required/>已获得团队同意，授权在站内展示本次填写的内容</label>{btn("提交展示申请")}</form></details>}
    </div>:emptyState("还没有协作项目。创建项目后可以邀请成员。")}</div>
    <form className="panel" onSubmit={submit("team",{},"项目已建立。")}><h3>创建协作项目</h3><Field name="title" label="项目名称"/><Select name="track" label="项目方向" choices={tracks}/><Select name="cohortId" label="关联场次" choices={[{key:"",text:"独立项目"},...applications.filter(a=>a.status==="admitted"&&a.data.role==="参与者").map(a=>({key:a.parent,text:a.data.cohortTitle}))]}/><Field name="problem" label="要解决的用户问题" area/>{btn("创建项目")}</form></div>{inbox(my("showcase"),"我的展示申请")}{inbox(my("learn"),"已完成的课程")} {inbox(my("savedResource"),"我的资源收藏")}</>}
  {page==="showcase"&&<><Intro title="项目展厅">查看经团队授权和运营审核的项目、原型、验证与合作需求。</Intro><label className="filterbar">按领域查看<select value={filter} onChange={e=>setFilter(e.target.value)}>{["全部",...tracks].map(t=><option key={t}>{t}</option>)}</select></label><div className="platform-directory">{kinds("showcase").filter(s=>(filter==="全部"||s.data.track===filter)&&(!query.get("id")||s.id===query.get("id"))).map(s=><Cover title={s.data.title} key={s.id}><span className="tag">{s.data.track}</span><p className="platform-body">{s.data.body}</p>{s.data.validation&&<><strong>验证证据</strong><p>{s.data.validation}</p></>}{s.data.need&&<><strong>正在寻找</strong><p>{s.data.need}</p></>}<SafeLink value={s.data.link} label="打开项目演示"/><div><a className="textlink" href={"#projects?id="+encodeURIComponent(s.id)}>项目独立页面</a></div></Cover>)}</div>{!kinds("showcase").some(s=>(filter==="全部"||s.data.track===filter)&&(!query.get("id")||s.id===query.get("id")))&&emptyState("当前没有符合条件的授权作品。")}{query.has("id")&&<a className="btn" href="#projects">返回所有展品</a>}<a className="btn primary" href="#teamspace">打开项目工作台</a></>}
  {page==="decisions"&&<><Intro title="Project Callback">活动项目可以带着新的验证证据回来。表决用于决定平台支持档期。</Intro><div className="twocol platform-columns"><div><p>普通档期需至少一半的资格名单参与、赞成票超过有效赞反票的一半。稀缺档期需至少三分之二参与、赞成票不少于有效赞反票的三分之二。弃权计参与但不计赞反票。</p><div className="platform-inbox">{kinds("callback").map(p=><Cover key={p.id} title={p.data.title}><Status value={p.status}/><p>{p.data.evidence}</p><p>{p.data.request}</p>{p.data.closesAt&&<p>截止 {new Date(p.data.closesAt).toLocaleString("zh-CN",{timeZone:"Europe/Copenhagen"})}（哥本哈根时间） · {p.data.eligibleCount} 位具资格成员</p>}{p.data.result&&<p>赞成 {p.data.result.yes} · 反对 {p.data.result.no} · 弃权 {p.data.result.abstain} · 最低参与 {p.data.result.quorum}</p>}
    {p.status==="voting"&&p.data.canVote&&<div className="platform-controls" aria-label="表决">{[{id:"yes",text:"赞成"},{id:"no",text:"反对"},{id:"abstain",text:"弃权"}].map(v=><button className={model.votes.some(x=>x.ballot===p.id&&x.choice===v.id)?"btn primary":"subtle"} key={v.id} disabled={sending} onClick={()=>act("vote",{id:p.id,choice:v.id},"已记录表决。截止前可以修改。")}>{v.text}</button>)}</div>}</Cover>)}</div>{inbox(my("callback"),"我的 Callback")}</div>
    {work.some(t=>t.owner===model.userId&&t.parent)?<form className="panel" onSubmit={submit("callback",{},"Callback 申请已提交。")}><h3>提交接续申请</h3><Select name="projectId" label="活动项目" choices={work.filter(t=>t.owner===model.userId&&t.parent).map(t=>({key:t.id,text:t.data.title}))}/><Field name="title" label="提案标题"/><Field name="evidence" label="已有成果与新增验证证据" area/><Field name="request" label="本次需要的支持" area/>{btn("提交 Callback")}</form>:<Cover title="申请条件"><p>先加入一个已录取的活动项目，由负责人提交后续申请。</p><a className="textlink" href="#cohorts">查看当前场次</a></Cover>}</div></>}
  {(page==="opportunities"||page==="women-resources")&&<ResourceLibrary women={page==="women-resources"} query={routeQuery} extra={kinds("resource").map(r=>({id:r.id,...r.data}) as Resource)} saved={my("savedResource").map(r=>r.parent)} ready={!sending&&status==="ready"} projects={work.map(r=>({id:r.id,title:r.data.title}))}
    save={id=>act("saveResource",{id},"已加入你的资源收藏。")}
    attach={(projectId,r,reason)=>act("evidence",{projectId,stage:"范围",title:("申请准备 · "+r.title).slice(0,120),body:r.title+"\n"+reason+"\n站内资源：https://founder2k.com/#opportunities?id="+encodeURIComponent(r.id),link:"https://founder2k.com/#opportunities?id="+encodeURIComponent(r.id)},"已将机会与材料缺口记录到团队工作台。")}/>}
  {page==="helpdesk"&&<><Intro title="支持与复核">提交问题可供运营查看处理结果。请不要粘贴其他人的私人聊天、健康数据或证件资料。</Intro><div className="twocol platform-columns"><div>{inbox(my("ticket"),"我的处理记录")}</div><form className="panel" onSubmit={submit("ticket",{},"已提交给站点运营。")}><Select name="category" label="问题类型" choices={["报名复核","资源纠错","协作与权益","其他"]}/><Field name="title" label="主题"/><Field name="body" label="请说明涉及的规则、时间、事实和你希望的处理结果" area/>{btn("提交给运营")}</form></div></>}
  {page==="operations"&&<><Intro title="运营后台">维护场次、审核理由、展示、资源与 Callback 评审。</Intro>
    {!model.admin&&status==="ready"&&emptyState("当前账户没有运营权限。")}
    {model.admin&&<><div className="filterbar">{["活动","申请","展示","Callback","内容","支持"].map(t=><button key={t} className={(selected||"活动")===t?"selected":""} onClick={()=>setSelected(t)}>{t}</button>)}</div>
    {(!selected||selected==="活动")&&<div className="twocol platform-columns"><div>{ops("cohort").map(c=><details className="platform-details" key={c.id}><summary>{c.data.title} <Status value={c.status}/></summary>{cohortForm(c)}</details>)}{!ops("cohort").length&&emptyState("还没有场次。先起草，确认安排后再开放报名。")}</div>{cohortForm()}</div>}
    {selected==="申请"&&<div className="platform-directory">{ops("application").map(a=><Cover title={a.data.name+" · "+a.data.cohortTitle} key={a.id}><Status value={a.status}/><p>{a.data.skills} · 每周 {a.data.hours} 小时 · {a.data.role}<br/>{a.data.email}</p><p>{a.data.goal}</p><SafeLink value={a.data.profile}/>
      {a.status!=="declined"&&<form onSubmit={submit("review",{id:a.id},"审核结果已记录。",false)}><Select name="decision" label="审核决定" choices={[{key:"needs_info",text:"需补充"},{key:"waitlist",text:"候补"},{key:"admitted",text:"录取"},{key:"declined",text:"未通过"}]}/><Field name="reason" label="实际理由与对应规则" area value={a.data.reason}/>{btn("保存决定")}</form>}</Cover>)}{!ops("application").length&&emptyState("暂无申请记录。")}</div>}
    {selected==="展示"&&<div className="platform-directory">{ops("showcase").map(p=><Cover key={p.id} title={p.data.title}><Status value={p.status}/><p>{p.data.body}</p><SafeLink value={p.data.link}/><form onSubmit={submit("visibility",{id:p.id,kind:"showcase"},"展示审核已保存。",false)}><Select name="decision" label="展示审核" choices={[{key:"listed",text:"同意展示"},{key:"declined",text:"未通过"},{key:"hidden",text:"撤下展示"}]}/><Field name="reason" label="审核与改进建议" area value={p.data.reason}/><details><summary>可选：结项评审分数</summary><div className="formrow"><Field name="problemScore" label="问题证据 / 30" type="number" min={0} max={30} value={p.data.scores?.problem} required={false}/><Field name="prototypeScore" label="原型与测试 / 25" type="number" min={0} max={25} value={p.data.scores?.prototype} required={false}/><Field name="learningScore" label="学习和迭代 / 25" type="number" min={0} max={25} value={p.data.scores?.learning} required={false}/><Field name="collaborationScore" label="贡献与协作 / 20" type="number" min={0} max={20} value={p.data.scores?.collaboration} required={false}/></div></details>{btn("保存审核")}</form></Cover>)}{!ops("showcase").length&&emptyState("暂无展示申请。")}</div>}
    {selected==="Callback"&&<div className="platform-directory">{ops("callback").map(p=><Cover key={p.id} title={p.data.title}><Status value={p.status}/><p>{p.data.evidence}</p><p>{p.data.request}</p>{p.status==="submitted"&&<form onSubmit={submit("openBallot",{id:p.id},"投票名单和档期规则已锁定。")}><Select name="tier" label="档期门槛" choices={[{key:"ordinary",text:"普通"},{key:"scarce",text:"稀缺"}]}/><Field name="days" label="表决天数" type="number" value={3}/>{btn("锁定规则并开启投票")}</form>}{p.status==="voting"&&<button className="btn primary" onClick={()=>act("finishBallot",{id:p.id},"表决结果已公布。")} disabled={sending}>结算已截止投票</button>}</Cover>)}{!ops("callback").length&&emptyState("暂无 Callback 申请。")}</div>}
    {selected==="内容"&&<><div className="twocol platform-columns"><form className="panel" onSubmit={submit("resource",{},"资源已发布。")}><h3>发布资源</h3><Field name="title" label="名称"/><Select name="type" label="类型" choices={["基金与资助","孵化器与加速器","比赛与奖项","投资机构","活动与路演","贷款与配套融资","工具与创业服务","研究汇总"]}/><Field name="region" label="地区"/><Field name="stage" label="适用阶段"/><Field name="source" label="官方来源" type="url"/><Field name="checked" label="核验日期" type="date"/><Field name="deadline" label="截止日期（选填）" type="date" required={false}/><Field name="body" label="资格与用途" area/><label className="check"><input name="women" type="checkbox"/>该资源明确面向或支持女性创业者，同步展示于女性共创</label>{btn("发布资源")}</form>
    <form className="panel" onSubmit={submit("lesson",{},"课程已发布。")}><h3>发布课程</h3><Field name="title" label="课程名称"/><Select name="track" label="方向" choices={tracks}/><Field name="body" label="课文或步骤" area/><Field name="exercise" label="练习与验收条件" area/><Field name="source" label="视频或材料链接（选填）" type="url" required={false}/>{btn("发布课程")}</form></div>
    <div className="platform-inbox">{["post","reply","resource","lesson"].flatMap(ops).map(p=><div className="recordrow" key={p.id}><div><strong>{p.data.title||p.data.body.slice(0,60)}</strong><p>{p.kind}</p></div><div className="platform-controls"><Status value={p.status}/><button className="subtle" disabled={sending} onClick={()=>act("visibility",{id:p.id,kind:p.kind,decision:p.status==="hidden"?"listed":"hidden"})}>{p.status==="hidden"?"恢复":"隐藏"}</button></div></div>)}</div></>}
    {selected==="支持"&&<div className="platform-directory">{ops("ticket").map(p=><Cover key={p.id} title={p.data.title}><Status value={p.status}/><p>{p.data.body}</p><form onSubmit={submit("visibility",{id:p.id,kind:"ticket",decision:"resolved"},"处理结果已保存。",false)}><Field name="reason" label="处理结果及理由" area value={p.data.reason}/>{btn("保存处理结果")}</form></Cover>)}{!ops("ticket").length&&emptyState("暂无支持记录。")}</div>}
    </>}
  </>}
  </div>;
}
