"use client";

import {useState} from "react";
import {ArrowUpRight,ArrowRight} from "lucide-react";
import {Button} from "@/components/ui/button";
import "./journeys.css";

const journeys = [
  {name:"创业者", goal:"把想法做成第一版", body:"先写下一个具体用户遇到的问题。组队后，把实验留在工作台，结项时再选择可展示的成果。", steps:["写问题卡","邀请互补的搭档","提交展示摘录"], action:"进入项目工作台", href:"teamspace", next:"查看创业资源", more:"opportunities"},
  {name:"投资者", goal:"判断哪些项目值得深入了解", body:"先读团队同意展示的成果与合作需求，再向愿意接收联系的创业者说明你关注的证据。", steps:["看授权成果","打开演示","提出具体问题"], action:"查看项目展厅", href:"projects", next:"寻找创业者", more:"people?filter=创业者"},
  {name:"导师", goal:"找到一个能帮上忙的问题", body:"从成员正在征求的反馈开始。你可以公开擅长的领域，也可以在收到请求后单独回复。", steps:["浏览反馈请求","设置联系意愿","回复站内请求"], action:"查看求反馈讨论", href:"community?filter=求反馈", next:"设置我的档案", more:"people"},
  {name:"正式参与者", goal:"加入一期创业快闪", body:"核对当期时段、工具和交付目标。报名后在工作台查看审核理由、补件和团队邀请。", steps:["核对场次","提交申请","查看审核结果"], action:"选择场次", href:"cohorts", next:"查看七天安排", more:"how"},
  {name:"旁听者", goal:"观察一次项目验证", body:"每期最多两位旁听者，同时受正式席位三分之一的上限约束。旁听可看开放展示，投票和团队私有资料另有资格要求。", steps:["核对旁听名额","提交旁听申请","参加获准环节"], action:"查找旁听场次", href:"cohorts?seat=observer", next:"查看参与原则", more:"principles"},
  {name:"销售参与者", goal:"留下一次可核对的市场测试", body:"先约定渠道归因与分配口径，再记录意向、实际到账、退款和成本。未成交也可以产出有价值的证据。", steps:["约定归因","测试一个渠道","记录成交或反例"], action:"记录市场测试", href:"teamspace?task=sales", next:"学习市场验证", more:"school"},
  {name:"开发参与者", goal:"交付别人能复现的原型", body:"从一个可测试的功能开始。给队友留下版本、复现步骤、失败现象和下一次迭代的范围。", steps:["定义验收条件","做可演示版本","交接测试证据"], action:"记录原型测试", href:"teamspace?task=build", next:"寻找测试反馈", more:"community?filter=求反馈"},
  {name:"AI 周期参与者", goal:"用已有 AI 工具验证想法", body:"正式参与者准备至少一个付费 AI 会员。课前试跑一个输入，记录工具输出和需要人工核对的环节。", steps:["核对会员要求","准备最小输入","记录人工核验"], action:"查看 AI 场次", href:"cohorts?cycle=AI", next:"浏览实操课程", more:"school"},
  {name:"非 AI 周期参与者", goal:"用访谈和手工原型验证服务", body:"无需 AI 会员。用纸样、人工交付或服务试演观察真实用户，记下具体行为和改动。", steps:["选一个场景","安排试演","记录用户行为"], action:"查看非 AI 场次", href:"cohorts?cycle=非AI", next:"阅读验证流程", more:"how"},
];

export function JourneyGuide(){
  const [index, choose]=useState(0);
  const journey=journeys[index];
  return <section className="journey-guide" aria-label="按角色选择参与路径">
    <div className="journey-lead"><h2>你想怎样参与？</h2><p>选择这次来访的身份，查看第一步和可以带走的成果。</p></div>
    <div className="journey-picker" aria-label="参与身份">{journeys.map((item,i)=><button key={item.name} aria-pressed={i===index} onClick={()=>choose(i)}>{item.name}</button>)}</div>
    <article className="journey-detail" aria-live="polite"><div><h3>{journey.goal}</h3><p>{journey.body}</p><div className="platform-controls"><a className="btn primary" href={"#"+journey.href}>{journey.action}</a><a className="textlink" href={"#"+journey.more}>{journey.next}</a></div></div><ol>{journey.steps.map(step=><li key={step}>{step}</li>)}</ol></article>
  </section>;
}

export function ClubOpening(){
  return <section className="field-opening" data-enter>
    <div className="field-cover"><div className="field-intro">
      <p className="folio"><span className="folio-line"/>创业快闪 · Sprint club</p>
      <h1>创业者的<br/><em>七天</em>实验室</h1>
      <p className="field-lead">带来一个问题，找到共创搭档。用访谈和原型完成第一次用户试验，再决定项目的下一步。</p>
      <div className="field-actions"><Button asChild size="lg"><a className="ed-action" href="#cohorts">查看活动场次 <ArrowUpRight data-icon="inline-end"/></a></Button><a className="field-link" href="#how">读快闪手册 <ArrowRight size={16}/></a></div>
    </div><div className="field-photo"><img src="/herstartup/school.webp" width="700" height="467" fetchPriority="high" alt="围坐在工作桌边进行项目讨论的参与者"/></div></div>
    <div className="field-index">{[["Sprint clubs","创业快闪","#sprints"],["HerStartupCamp","女性共创","#women"],["Opportunity library","创业资源库","#opportunities"]].map(([en,zh,href])=><a key={href} href={href}><span><small lang="en">{en}</small><strong>{zh}</strong></span><ArrowUpRight aria-hidden="true"/></a>)}</div>
  </section>;
}
