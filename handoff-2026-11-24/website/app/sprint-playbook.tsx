"use client";
import {useState} from "react";
import {ArrowLeft, ArrowUpRight, Check} from "lucide-react";
import {Button} from "@/components/ui/button";

const editions = {
  ai:{name:"AI service lab",title:"AI 服务快闪",image:"growth",alt:"笔记本电脑上的工作界面",brief:"选择一个可以人工验证的服务场景，用一周做出第一版，交给真实用户试用。"},
  bio:{name:"Bio × AI",title:"生物与 AI 工作坊",image:"foundation",alt:"伙伴围绕笔记本电脑讨论方案",brief:"从研究问题、应用场景和证据地图开始。专题的时长和导师安排按具体项目确定。"},
  hardware:{name:"Physical intelligence",title:"AI 与硬件工作坊",image:"school",alt:"工作桌上的团队协作",brief:"选择一个能在真实环境中测试的交互，把算法、硬件和用户反馈放进同一个实验。"},
  nonai:{name:"Human-first ventures",title:"非 AI 创业快闪",image:"practice",alt:"两位伙伴面对面沟通",brief:"用访谈、纸样或手工交付测试一项服务。参与这一周期无需 AI 会员。"}
};
export const practiceWeek=[
  ["问题","定义一个值得解决的问题","写出目标用户、遇到的困难以及团队成员能贡献什么。","一张问题卡"],
  ["访谈","听一听目标用户的做法","访谈潜在用户，记录他们现在的替代方案，以及不支持原假设的例子。","访谈记录"],
  ["范围","约定这个周期的边界","选一个功能或服务环节，确定验收条件、个人分工和成果使用约定。","项目范围与分工"],
  ["原型","制作可以试用的第一版","让队友能复现这项服务，或按写下的方案执行一次实验。","可演示原型或实验方案"],
  ["试用","把第一版交给用户","观察使用过程，记下失败点、反馈和决定修改的地方。","真实反馈与修改记录"],
  ["市场","测试表达和渠道","试一次市场触达，保留响应、交付成本及下一轮想验证的问题。","渠道试验记录"],
  ["复盘","用证据决定下一步","展示这次试验，记录每个人的贡献，再决定继续、调整或暂缓。","演示、贡献记录与复盘"]
];
export function SprintPlaybook({track,general}:{track:string;general:boolean}){
  const editionKey=!general && Object.hasOwn(editions,track) ? track as keyof typeof editions : "ai";
  const e=editions[editionKey];
  const [day,pick]=useState(0);
  const specialized=editionKey==="bio"||editionKey==="hardware";
  const cohortLink=general||specialized?"#cohorts":"#cohorts?cycle="+(editionKey==="nonai"?"非AI":"AI");
  return <article className="edition">
    <a className="edition-back" href="#sprints"><ArrowLeft size={16}/> 所有快闪计划</a>
    <div className="edition-cover" data-enter><div className="edition-type">
      <p className="folio">{general?"创业快闪 · 活动手册":e.title+" · 筹备中"}</p>
      <h1 lang="en">{general?"Sprint playbook":e.name}</h1>
      <p>{general?"从一个具体问题开始，依次完成访谈、原型、试用和复盘。":e.brief}</p>
      <Button asChild size="lg"><a href={cohortLink} className="ed-action">查看活动场次 <ArrowUpRight data-icon="inline-end"/></a></Button>
    </div><div className="edition-photo"><img src={"/herstartup/"+e.image+".webp"} alt={e.alt}/></div></div>
    <div className="edition-columns"><section className="week"><p className="folio">Sprint playbook</p><h2>{specialized?"项目验证框架":"七天实践日程"}</h2>
      <div className="day-rail" aria-label="选择实践日">{practiceWeek.map(([s],i)=><button key={s} aria-pressed={i===day} onClick={()=>pick(i)}><span>D{String(i+1).padStart(2,"0")}</span>{s}</button>)}</div>
      <div className="day-sheet" aria-live="polite"><span className="day-digit" aria-hidden="true">{String(day+1).padStart(2,"0")}</span><div><h3>{practiceWeek[day][1]}</h3><p>{practiceWeek[day][2]}</p><strong><Check size={16}/> 当天交付 · {practiceWeek[day][3]}</strong></div></div>
      <details><summary>展开完整日程</summary><ol>{practiceWeek.map(([,t,,out])=><li key={t}><b>{t}</b><span>{out}</span></li>)}</ol></details></section>
    <aside className="edition-notes"><h2>参与须知</h2><p>{specialized?"专业议题、时长和导师按场次确定。":"建议每天预留 1–2 小时，另加开场和展示。"}日期、地点和费用以正式场次为准。</p><ul><li>AI 周期的正式参与者需准备付费 AI 会员并完成准备任务。非 AI 周期无需会员。</li><li>作品由团队决定是否公开，摄影单独征得同意。</li><li>营收、融资与公司成立由项目进展决定。</li></ul><a href="#apply">登记试点意向 ↗</a><a href="#principles">阅读参与原则 ↗</a></aside></div>
  </article>
}
