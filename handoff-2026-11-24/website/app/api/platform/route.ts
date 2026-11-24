import { env } from "cloudflare:workers";
import { z } from "zod";
import { getChatGPTUser } from "../../chatgpt-auth";
import calendar from "../../funding-calendar.json";
import { starterLessons, starterResources } from "../../platform-content";

export const dynamic = "force-dynamic";

type Data = Record<string, unknown>;
type Entry = {id:string;kind:string;owner:string;parent:string;status:string;payload:string;created:number;updated:number};
type Actor = NonNullable<Awaited<ReturnType<typeof getChatGPTUser>>>;
const text = (limit: number) => z.string().trim().min(1).max(limit);
const id = text(100);
const optional = (limit: number) => z.string().trim().max(limit).optional();
const https = z.string().max(1200).url().refine(s => s.startsWith("https://"), "链接必须使用 HTTPS");
const optionalLink = z.union([https, z.literal("")]).optional();
const channels = z.enum(["找共创", "求反馈", "分享进展", "女性共创"]);
const track = z.enum(["AI 服务", "非 AI 创业", "生物与 AI", "AI 与硬件", "女性共创"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const at = new Date(s);
  return Number.isFinite(+at) && at.toISOString().slice(0,10) === s;
}, "请输入有效日期");

class Problem extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const fail = (status: number, message: string): never => { throw new Problem(status, message); };
const response = (body: unknown, status = 200) => Response.json(body, {
  status, headers: {"Cache-Control":"private, no-store"},
});
function database() {
  if (!env.DB) return fail(503, "数据库暂时不可用");
  return env.DB;
}
async function actor() {
  const user = await getChatGPTUser();
  if (!user) return fail(401, "请先登录再继续");
  // The platform supplies the authenticated identity, including in its loopback test mode.
  const adminEmail = env.FOUNDER2K_ADMIN_EMAIL ?? (import.meta.env.DEV ? "seedy@sites.test" : "");
  return {user, admin: !!adminEmail && user.email.toLowerCase() === adminEmail.trim().toLowerCase()};
}
function requireAdmin(admin: boolean) {
  if (!admin) fail(403, "这项操作需要运营权限");
}
function catchError(error: unknown) {
  if (error instanceof Problem) return response({error:error.message}, error.status);
  if (error instanceof z.ZodError) return response({error:"请核对填写内容及字段长度", fields:error.flatten().fieldErrors}, 400);
  console.error("Founder2K platform request failed", error instanceof Error ? error.name : "unknown");
  return response({error:"操作暂时无法完成，请稍后重试"}, 503);
}
const payload = (entry: Entry): Data => JSON.parse(entry.payload);
function view(entry: Entry, includeOwner = false, shared = false) {
  const data = payload(entry);
  if (entry.kind === "callback") delete data.eligible;
  if (shared) {
    delete data.reason;
    delete data.history;
    delete data.scores;
    delete data.scoreTotal;
  }
  return {id:entry.id, kind:entry.kind, parent:entry.parent, status:entry.status, data, updated:entry.updated, ...(includeOwner ? {owner:entry.owner} : {})};
}
async function rows(sql: string, ...args: unknown[]) {
  return (await database().prepare(sql).bind(...args).all<Entry>()).results;
}
async function entry(id: string, kind: string) {
  const value = await database().prepare("SELECT * FROM platform_items WHERE id=? AND kind=?").bind(id,kind).first<Entry>();
  if (!value) return fail(404, "未找到这条记录");
  return value;
}
async function write(kind:string, owner:string, data:Data, status:string, parent="", key:string=crypto.randomUUID(), replace=false) {
  const sql = "INSERT INTO platform_items(id,kind,owner,parent,status,payload,created,updated) VALUES (?,?,?,?,?,?,?,?)";
  const update = " ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,status=excluded.status,updated=excluded.updated WHERE owner=excluded.owner AND kind=excluded.kind";
  const now = Date.now();
  await database().prepare(sql + (replace ? update : " ON CONFLICT(id) DO NOTHING"))
    .bind(key,kind,owner,parent,status,JSON.stringify(data),now,now).run();
  return {id:key};
}
async function keyFor(...parts:string[]) {
  const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(parts)));
  return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,"0")).join("");
}
async function change(item:Entry, status:string, data=payload(item), expected=item.status) {
  const result = await database().prepare("UPDATE platform_items SET status=?,payload=?,updated=? WHERE id=? AND status=? AND updated=?")
    .bind(status,JSON.stringify(data),Math.max(Date.now(),item.updated+1),item.id,expected,item.updated).run();
  if (!result.meta.changes) fail(409, "状态已变化，请刷新后重试");
  return {id:item.id};
}
function withDecision(item:Entry, status:string, reason:string, reviewer:string) {
  const data = payload(item);
  const previous = Array.isArray(data.history) ? data.history.slice(-29) : [];
  return {...data, reason, history:[...previous,{status,reason,reviewer,at:Date.now(),rules:"pilot-2026-11"}]};
}
async function isMember(project:Entry, user:string) {
  if (project.owner===user) return true;
  const invite = await database().prepare("SELECT id FROM platform_items WHERE kind='invite' AND parent=? AND owner=? AND status='accepted'").bind(project.id,user).first();
  return !!invite;
}

export async function GET() {
  try {
    const {user,admin} = await actor();
    const [catalog,mine,teams,operations,votes,connections] = await Promise.all([
      rows(`SELECT * FROM platform_items WHERE
        (kind='cohort' AND status IN ('open','closed')) OR
        (kind IN ('profile','post','resource','lesson','showcase') AND status='listed') OR
        (kind='reply' AND status='listed' AND parent IN (SELECT id FROM platform_items WHERE kind='post' AND status='listed')) OR
        (kind='callback' AND status IN ('voting','approved','declined'))
        ORDER BY updated DESC LIMIT 400`),
      rows("SELECT * FROM platform_items WHERE owner=? ORDER BY updated DESC LIMIT 300",user.userId),
      rows(`SELECT * FROM platform_items WHERE
        (kind='team' AND (owner=? OR id IN (SELECT parent FROM platform_items WHERE kind='invite' AND owner=? AND status='accepted')))
        OR (kind IN ('evidence','invite') AND parent IN
          (SELECT id FROM platform_items WHERE kind='team' AND (owner=? OR id IN
            (SELECT parent FROM platform_items WHERE kind='invite' AND owner=? AND status='accepted'))))
        ORDER BY updated DESC LIMIT 400`, ...Array(4).fill(user.userId)),
      admin ? rows(`SELECT * FROM platform_items WHERE kind IN
        ('cohort','application','showcase','callback','post','reply','resource','lesson','ticket')
        ORDER BY updated DESC LIMIT 400`) : Promise.resolve([]),
      database().prepare("SELECT ballot,choice FROM platform_votes WHERE voter=?").bind(user.userId).all<{ballot:string;choice:string}>(),
      rows(`SELECT * FROM platform_items WHERE kind='connection' AND parent IN
          (SELECT id FROM platform_items WHERE kind='profile' AND owner=?)
        ORDER BY updated DESC LIMIT 100`,user.userId),
    ]);
    const c = catalog.map(item => {
      const output = view(item,false,true);
      if(item.kind==="callback") output.data.canVote = (payload(item).eligible as string[]|undefined)?.includes(user.userId) ?? false;
      return output;
    });
    // Only a direct recipient should see the incoming invitation before acceptance.
    const projects = teams.filter(i => i.kind!=="invite" || i.owner===user.userId ||
      teams.some(t=>t.id===i.parent && t.owner===user.userId));
    return response({admin, userId:user.userId, catalog:c, mine:mine.map(e=>view(e)),
      teams:projects.map(e=>view(e,true)), operations:operations.map(e=>view(e)), votes:votes.results,
      connections:connections.map(e=>view(e))});
  } catch (error) { return catchError(error); }
}

const makeCohort = z.object({
  title:text(120), track, cycle:z.enum(["AI","非AI","unspecified"]).default("unspecified"), start:isoDate, end:isoDate, location:text(200), seats:z.coerce.number().int().min(1).max(80),
  requirements:text(2200), outcome:text(1500), format:z.enum(["线上","线下","混合"]),
  stage:z.enum(["draft","open","closed"]), id:id.optional(),
}).refine(p=>p.end>=p.start, {path:["end"],message:"结束日期不可早于开始日期"});

async function cohortAction(raw:unknown, user:Actor) {
  const {id:previous,stage,...data}=makeCohort.parse(raw);
  if (previous) return change(await entry(previous,"cohort"),stage,data);
  return write("cohort",user.userId,data,stage);
}
async function apply(raw:unknown, user:Actor) {
  const {cohortId,...data}=z.object({
    cohortId:id,name:text(80),email:z.string().trim().email().max(254),goal:text(2400),skills:text(800),
    hours:z.coerce.number().int().min(1).max(80), role:z.enum(["参与者","旁听"]), profile:optionalLink, paidAI:z.boolean().optional(), consent:z.literal(true),
  }).parse(raw);
  const cohort=await entry(cohortId,"cohort");
  if(cohort.status!=="open") return fail(409,"本期目前不接受申请");
  if(payload(cohort).cycle==="AI" && data.role==="参与者" && !data.paidAI) return fail(400,"正式参加 AI 周期需要确认付费 AI 会员");
  const key=await keyFor("application",user.userId,cohortId);
  const now=Date.now();
  const result=await database().prepare(`INSERT INTO platform_items(id,kind,owner,parent,status,payload,created,updated)
    SELECT ?, 'application', ?, id, 'submitted', ?, ?, ? FROM platform_items WHERE id=? AND kind='cohort' AND status='open' AND updated=?
    ON CONFLICT(id) DO UPDATE SET payload=json_set(excluded.payload,'$.history',json_extract(platform_items.payload,'$.history')),
    status='submitted',updated=excluded.updated
    WHERE platform_items.status='needs_info'`)
    .bind(key,user.userId,JSON.stringify({...data,cohortTitle:payload(cohort).title,consentVersion:"pilot-2026-11",consentedAt:now}),now,now,cohortId,cohort.updated).run();
  if(!result.meta.changes) return fail(409,"已有申请或报名已关闭，可在工作台查看状态");
  return {id:key};
}
async function review(raw:unknown, admin:boolean, reviewer:string) {
  requireAdmin(admin);
  const {id:key,decision,reason}=z.object({id,decision:z.enum(["needs_info","waitlist","admitted","declined"]),reason:text(1800)}).parse(raw);
  const item=await entry(key,"application");
  if(!["submitted","needs_info","waitlist","admitted"].includes(item.status)) return fail(409,"申请已结束");
  const updated=withDecision(item,decision,reason,reviewer);
  if(decision!=="admitted") return change(item,decision,updated);
  const cohort=await entry(item.parent,"cohort");
  const role=payload(item).role;
  const seats=Number(payload(cohort).seats);
  // A conditional write protects the last seat when two decisions arrive together.
  const result=await database().prepare(`UPDATE platform_items SET status='admitted',payload=?,updated=?
    WHERE id=? AND status=? AND updated=? AND (SELECT COUNT(*) FROM platform_items
       WHERE kind='application' AND parent=? AND id!=? AND status='admitted' AND json_extract(payload,'$.role')=?) < ?`)
    .bind(JSON.stringify(updated),Math.max(Date.now(),item.updated+1),item.id,item.status,item.updated,item.parent,item.id,role,
      role==="旁听"?Math.min(2,Math.floor(seats/3)):seats).run();
  if(!result.meta.changes) return fail(409,"名额已满或记录已更新");
  return {id:key};
}
async function profileAction(raw:unknown,user:Actor) {
  const {listed,...data}=z.object({name:text(80),role:z.enum(["创业者","共创者","导师","投资人"]),
    skills:text(320),bio:text(1000),timezone:text(80),link:optionalLink,listed:z.boolean(),
    acceptsContact:z.boolean().default(false)}).parse(raw);
  return write("profile",user.userId,data,listed?"listed":"draft","",await keyFor("profile",user.userId),true);
}
async function connect(raw:unknown,user:Actor) {
  const {profileId,purpose,question}=z.object({profileId:id,purpose:z.enum(["寻找共创","导师问答","投资沟通"]),question:text(1800)}).parse(raw);
  const target=await entry(profileId,"profile");
  if(target.owner===user.userId||target.status!=="listed"||payload(target).acceptsContact!==true) return fail(409,"对方目前不接收联系请求");
  const from=await database().prepare("SELECT * FROM platform_items WHERE kind='profile' AND owner=?").bind(user.userId).first<Entry>();
  const key=await keyFor("connection",user.userId,profileId,purpose);
  return write("connection",user.userId,{title:purpose+" · "+payload(target).name,from:from?payload(from).name:"成员",question},"pending",profileId,key);
}
async function respondConnection(raw:unknown,user:Actor) {
  const {id:key,decision,reply}=z.object({id,decision:z.enum(["accepted","declined"]),reply:optional(1200)}).parse(raw);
  const request=await entry(key,"connection");
  const target=await entry(request.parent,"profile");
  if(target.owner!==user.userId) return fail(403,"仅联系接收人可回复");
  if(request.status!=="pending") return fail(409,"联系请求已处理");
  return change(request,decision,{...payload(request),reason:reply||""});
}
async function teamAction(raw:unknown,user:Actor) {
  const {cohortId,...data}=z.object({title:text(120),problem:text(1400),track,cohortId:z.union([id,z.literal("")]).optional()}).parse(raw);
  if(cohortId){
    const membership=await database().prepare("SELECT id FROM platform_items WHERE kind='application' AND owner=? AND parent=? AND status='admitted' AND json_extract(payload,'$.role')='参与者'").bind(user.userId,cohortId).first();
    if(!membership) return fail(403,"需先获得该期参与者资格");
  }
  return write("team",user.userId,data,"active",cohortId||"");
}
async function inviteAction(raw:unknown,user:Actor) {
  const {projectId,profileId}=z.object({projectId:id,profileId:id}).parse(raw);
  const [project,profile]=await Promise.all([entry(projectId,"team"),entry(profileId,"profile")]);
  if(project.owner!==user.userId || profile.status!=="listed" || profile.owner===user.userId) return fail(403,"此邀请当前不可发送");
  return write("invite",profile.owner,{projectTitle:payload(project).title,name:payload(profile).name},
    "pending",project.id,await keyFor("invite",project.id,profile.owner));
}
async function respondInvite(raw:unknown,user:Actor) {
  const {id:key,decision}=z.object({id,decision:z.enum(["accepted","declined"])}).parse(raw);
  const item=await entry(key,"invite");
  if(item.owner!==user.userId) return fail(403,"请由邀请接收人操作");
  if(item.status!=="pending") return fail(409,"邀请已处理");
  if(decision==="accepted"){
    const active=await database().prepare("SELECT id FROM platform_items WHERE kind='callback' AND parent=? AND status='voting'").bind(item.parent).first();
    if(active) return fail(409,"项目正在表决，请在投票结算后接受邀请");
  }
  return change(item,decision);
}
async function evidenceAction(raw:unknown,user:Actor) {
  const {projectId,...data}=z.object({projectId:id,stage:z.enum(["问题","访谈","范围","原型","试用","市场","复盘"]),
    title:text(120),body:text(3000),link:optionalLink}).parse(raw);
  const project=await entry(projectId,"team");
  if(!await isMember(project,user.userId)) return fail(403,"仅团队成员可提交成果");
  return write("evidence",user.userId,data,"saved",projectId);
}
async function showcaseAction(raw:unknown,user:Actor) {
  const {projectId,...data}=z.object({projectId:id,title:text(120),body:text(2200),track,link:optionalLink,validation:optional(1000),need:optional(800),permission:z.literal(true)}).parse(raw);
  const project=await entry(projectId,"team");
  if(project.owner!==user.userId) return fail(403,"仅项目负责人可申请展示");
  return write("showcase",user.userId,data,"submitted",projectId);
}
async function callbackAction(raw:unknown,user:Actor) {
  const {projectId,title,evidence,request}=z.object({projectId:id,title:text(120),evidence:text(2200),request:text(1500)}).parse(raw);
  const project=await entry(projectId,"team");
  if(project.owner!==user.userId) return fail(403,"仅项目负责人可申请");
  if(!project.parent) return fail(409,"请从已录取的活动项目提交 Callback");
  return write("callback",user.userId,{title,evidence,request,cohortId:project.parent},"submitted",projectId,
    await keyFor("callback",projectId));
}
async function openBallot(raw:unknown,admin:boolean) {
  requireAdmin(admin);
  const {id:key,tier,days}=z.object({id,tier:z.enum(["ordinary","scarce"]),days:z.coerce.number().int().min(1).max(30)}).parse(raw);
  const item=await entry(key,"callback");
  if(item.status!=="submitted") return fail(409,"本申请已处理");
  const data=payload(item);
  const list=await rows(`SELECT * FROM platform_items WHERE kind='application' AND parent=? AND status='admitted'
     AND json_extract(payload,'$.role')='参与者' AND owner!=? AND owner NOT IN
     (SELECT owner FROM platform_items WHERE kind='invite' AND parent=? AND status='accepted')`,data.cohortId,item.owner,item.parent);
  const eligible=[...new Set(list.map(r=>r.owner))];
  if(!eligible.length) return fail(409,"本期暂无符合条件且无团队利益关联的投票人");
  return change(item,"voting",{...data,tier,eligible,eligibleCount:eligible.length,closesAt:Date.now()+days*86400000});
}
async function voteAction(raw:unknown,user:Actor) {
  const {id:key,choice}=z.object({id,choice:z.enum(["yes","no","abstain"])}).parse(raw);
  const result=await database().prepare(`INSERT INTO platform_votes(ballot,voter,choice)
    SELECT id,?,? FROM platform_items WHERE id=? AND kind='callback' AND status='voting'
      AND json_extract(payload,'$.closesAt')>CAST(unixepoch('subsec')*1000 AS INTEGER)
      AND EXISTS (SELECT 1 FROM json_each(payload,'$.eligible') WHERE value=?)
      AND NOT EXISTS (SELECT 1 FROM platform_items invites WHERE invites.kind='invite'
        AND invites.parent=platform_items.parent AND invites.owner=? AND invites.status='accepted')
    ON CONFLICT(ballot,voter) DO UPDATE SET choice=excluded.choice`).bind(user.userId,choice,key,user.userId,user.userId).run();
  if(!result.meta.changes) return fail(403,"投票已关闭或你不在该提案的资格名单");
  return {id:key};
}
async function finishBallot(raw:unknown,admin:boolean) {
  requireAdmin(admin);
  const {id:key}=z.object({id}).parse(raw);
  const item=await entry(key,"callback");
  if(item.status!=="voting") return fail(409,"投票未开启或已结算");
  const data=payload(item);
  if(Date.now()<Number(data.closesAt)) return fail(409,"请等待投票截止后再结算");
  const counts=(await database().prepare("SELECT choice,COUNT(*) AS total FROM platform_votes WHERE ballot=? GROUP BY choice").bind(key).all<{choice:string;total:number}>()).results;
  const count=(choice:string)=>counts.find(x=>x.choice===choice)?.total??0;
  const yes=count("yes"),no=count("no"),abstain=count("abstain");
  const scarce=data.tier==="scarce", eligible=Number(data.eligibleCount);
  const quorum=Math.ceil(eligible*(scarce?2/3:1/2));
  const passed=yes+no+abstain>=quorum && yes+no>0 && (scarce?3*yes>=2*(yes+no):yes>no);
  return change(item,passed?"approved":"declined",{...data,result:{yes,no,abstain,quorum}});
}
async function communityAction(raw:unknown,user:Actor) {
  const {title,body,channel,postId}=z.object({title:optional(120),body:text(2600),channel:channels.optional(),postId:id.optional()}).parse(raw);
  const profile=await database().prepare("SELECT * FROM platform_items WHERE owner=? AND kind='profile' AND status='listed'").bind(user.userId).first<Entry>();
  const author=profile?payload(profile).name:"成员";
  if(postId){
    if((await entry(postId,"post")).status!=="listed") return fail(404,"帖子当前不可回复");
    return write("reply",user.userId,{body,author},"listed",postId);
  }
  if(!title||!channel) return fail(400,"请填写标题并选择讨论分类");
  return write("post",user.userId,{title,body,channel,author},"listed");
}
async function curate(raw:unknown,user:Actor,kind:"resource"|"lesson") {
  const data=kind==="resource"
    ? z.object({title:text(130),body:text(1800),type:z.enum(["基金","孵化器","比赛","加速器","工具与指南","基金与资助","孵化器与加速器","比赛与奖项","投资机构","活动与路演","贷款与配套融资","工具与创业服务","研究汇总"]),women:z.union([z.boolean(),z.literal("on")]).optional().transform(v=>v===true||v==="on"),
      region:text(80),stage:text(100),source:https,checked:isoDate,deadline:z.union([isoDate,z.literal("")]).optional()}).parse(raw)
    : z.object({title:text(130),body:text(8000),track,exercise:text(2000),source:optionalLink}).parse(raw);
  return write(kind,user.userId,data,"listed");
}
async function visibility(raw:unknown,admin:boolean,reviewer:string) {
  requireAdmin(admin);
  const fields=z.object({id,kind:z.enum(["post","reply","showcase","lesson","resource","ticket"]),
    decision:z.enum(["listed","hidden","declined","resolved"]),reason:optional(1800),
    scores:z.object({
      problem:z.coerce.number().int().min(0).max(30),
      prototype:z.coerce.number().int().min(0).max(25),
      learning:z.coerce.number().int().min(0).max(25),
      collaboration:z.coerce.number().int().min(0).max(20),
    }).optional(),
  }).parse(raw);
  const {id:key,kind,decision,reason}=fields;
  const item=await entry(key,kind);
  if(kind==="showcase" && !reason) return fail(400,"请填写项目展示审核理由");
  if(kind==="showcase" && !["listed","declined","hidden"].includes(decision)) return fail(400,"展示审核结果无效");
  if(kind==="ticket" && (decision!=="resolved"||!reason)) return fail(400,"请填写处理结果");
  if(!["showcase","ticket"].includes(kind) && !["listed","hidden"].includes(decision)) return fail(400,"该内容仅支持显示或隐藏");
  const data:Data=withDecision(item,decision,reason||"",reviewer);
  if(kind==="showcase"&&fields.scores){
    data.scores=fields.scores;
    data.scoreTotal=Object.values(fields.scores).reduce((total,score)=>total+score,0);
  }
  return change(item,decision,data);
}

export async function POST(request:Request) {
  try {
    const {user,admin}=await actor();
    if(request.headers.get("origin")!==new URL(request.url).origin) {
      await request.body?.cancel().catch(()=>{});
      return fail(403,"请求来源不匹配");
    }
    const raw=await request.text();
    if(raw.length>24000) return fail(413,"内容过长");
    let parsed:unknown;
    try { parsed=JSON.parse(raw); } catch { return fail(400,"格式错误"); }
    const {action,data}=z.object({action:text(40),data:z.unknown()}).parse(parsed);
    let result:unknown;
    switch(action){
      case "cohort": requireAdmin(admin); result=await cohortAction(data,user);break;
      case "apply": result=await apply(data,user);break;
      case "review": result=await review(data,admin,user.userId);break;
      case "profile": result=await profileAction(data,user);break;
      case "connect": result=await connect(data,user);break;
      case "connection": result=await respondConnection(data,user);break;
      case "team": result=await teamAction(data,user);break;
      case "invite": result=await inviteAction(data,user);break;
      case "invitation": result=await respondInvite(data,user);break;
      case "evidence": result=await evidenceAction(data,user);break;
      case "showcase": result=await showcaseAction(data,user);break;
      case "callback": result=await callbackAction(data,user);break;
      case "openBallot": result=await openBallot(data,admin);break;
      case "vote": result=await voteAction(data,user);break;
      case "finishBallot": result=await finishBallot(data,admin);break;
      case "post": result=await communityAction(data,user);break;
      case "resource": case "lesson": requireAdmin(admin);result=await curate(data,user,action);break;
      case "visibility": result=await visibility(data,admin,user.userId);break;
      case "learn": {
        const {id:key}=z.object({id}).parse(data);
        const builtIn=starterLessons.find(lesson=>lesson.id===key);
        let title:unknown=builtIn?.title;
        if(!title){
          const lesson=await entry(key,"lesson");
          if(lesson.status!=="listed") return fail(404,"课程当前不可用");
          title=payload(lesson).title;
        }
        result=await write("learn",user.userId,{title},"completed",key,await keyFor("learn",user.userId,key));break;
      }
      case "saveResource": {
        const {id:key}=z.object({id}).parse(data);
        let resource:Data|undefined=calendar.find(item=>item.id===key)||starterResources.find(item=>item.id===key);
        if(!resource){
          const item=await entry(key,"resource");
          if(item.status!=="listed") return fail(404,"该资源暂时不可用");
          resource=payload(item);
        }
        result=await write("savedResource",user.userId,{title:resource.title,source:resource.source},"saved",key,await keyFor("savedResource",user.userId,key));break;
      }
      case "ticket": {
        const fields=z.object({title:text(120),body:text(2600),category:z.enum(["报名复核","资源纠错","协作与权益","其他"])}).parse(data);
        result=await write("ticket",user.userId,fields,"submitted");break;
      }
      default: return fail(400,"未知操作");
    }
    return response(result);
  } catch(error) { return catchError(error); }
}
