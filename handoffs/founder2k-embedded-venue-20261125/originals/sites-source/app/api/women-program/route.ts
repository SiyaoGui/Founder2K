import {env} from "cloudflare:workers";
import {z} from "zod";
import {getChatGPTUser} from "../../chatgpt-auth";
import {capacity,schedule,type Member,type Meeting} from "../../women-matching";

export const dynamic="force-dynamic";
type Guest=Member & {account:string};
type Invite={lead:string; partner:string; state:"pending"|"accepted"|"declined"};
type Session={title:string; start:string; revision:number; published:boolean; members:Guest[]; meetings:Meeting[]; invites:Invite[]; teams:Record<string,string>; submitted:string[]; feedback:Record<string,string>};
type Row={id:string;data:string};
const kind="women-program";
const db=()=>env.DB!;
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{"Cache-Control":"private, no-store"}});
const field=(n:number)=>z.string().trim().min(1).max(n);
class Issue extends Error{constructor(public code:number,msg:string){super(msg)}}
function need(value:unknown,code:number,msg:string):asserts value{if(!value)throw new Issue(code,msg)}
function onError(e:unknown){return e instanceof Issue?reply({error:e.message},e.code):e instanceof z.ZodError||e instanceof SyntaxError?reply({error:"请检查必填信息和长度。"},400):reply({error:"暂时无法读取或保存本场活动。"},503)}
async function actor(){
  const u=await getChatGPTUser();need(u,401,"登录后可以使用本期活动。");
  const admin=env.FOUNDER2K_ADMIN_EMAIL??(import.meta.env.DEV?"seedy@sites.test":"");
  return {account:u.userId,admin:!!admin&&admin.toLowerCase()===u.email.toLowerCase()};
}
async function get(id:string){
  const row=await db().prepare("SELECT id,data FROM her_entries WHERE id=? AND kind=?").bind(id,kind).first<Row>();
  need(row,404,"找不到该场活动。");return JSON.parse(row.data) as Session;
}
export async function GET(req:Request){try{
  const {account,admin}=await actor(), id=new URL(req.url).searchParams.get("id");
  if(!id){const rows=await db().prepare("SELECT id,json_extract(data,'$.title') AS title,json_extract(data,'$.start') AS start,json_extract(data,'$.published') AS published FROM her_entries WHERE kind=? ORDER BY start DESC").bind(kind).all();
    return reply({admin,sessions:rows.results});}
  const s=await get(id),self=s.members.find(m=>m.account===account), me=self?.id;
  const entitled=admin||!!self;
  return reply({id,admin,me,revision:s.revision,title:s.title,start:s.start,published:s.published,
    members:entitled?s.members.map(({id,name,role,topic,availability})=>({id,name,role,topic,availability})):[],
    choices:self?.choices||[],open:!!self?.open,meetings:s.meetings.filter(m=>admin||m.lead===me||m.partner===me),
    invites:s.invites.filter(i=>admin||i.lead===me||i.partner===me),submitted:s.submitted.filter(l=>admin||l===me),
    feedback:admin?s.feedback:me?{[me]:s.feedback[me]}:{},
    teams:Object.fromEntries(Object.entries(s.teams).filter(([lead])=>admin||lead===me||s.invites.some(i=>i.lead===lead&&i.partner===me&&i.state==="accepted")))});
}catch(e){return onError(e)}}

export async function POST(req:Request){try{
  const {account,admin}=await actor();need(req.headers.get("origin")===new URL(req.url).origin,403,"无效来源。");
  const {action,id,revision,data}=z.object({action:field(30),id:field(100).optional(),revision:z.number().int().optional(),data:z.record(z.unknown()).default({})}).parse(await req.json());
  if(action==="create"){
    need(admin,403,"需要运营权限。");const {title,start}=z.object({title:field(100),start:z.string().datetime()}).parse(data);
    need(Date.parse(start)>Date.now(),400,"请选择未来的场次。");
    const key=crypto.randomUUID(), session:Session={title,start,revision:0,published:false,members:[],meetings:[],invites:[],teams:{},submitted:[],feedback:{}};
    await db().prepare("INSERT INTO her_entries(id,kind,author,target,state,updated,data) VALUES(?,?,'program-operations','','private',?,?)").bind(key,kind,Date.now(),JSON.stringify(session)).run();
    return reply({id:key});
  }
  need(id,400,"请选择活动。");const s=await get(id);need(s.revision===revision,409,"场次有更新，请刷新后重试。");
  const self=s.members.find(m=>m.account===account),me=self?.id;
  const editable=!s.published&&Date.parse(s.start)>Date.now();
  const extra:ReturnType<ReturnType<typeof db>["prepare"]>[]=[];
  if(action==="register"){
    need(editable&&!self,409,"当前无法新增报名。");
    const d=z.object({name:field(60),role:z.enum(["项目发起人","共创伙伴"]),topic:field(400),availability:field(160),consent:z.literal(true)}).parse(data);
    need(s.members.filter(m=>m.role===d.role).length<capacity[d.role],409,"这一身份名额已满。请选择其他场次或联系运营。");
    const {consent,...card}=d;
    s.members.push({...card,id:crypto.randomUUID(),account,open:false,choices:[]});
  }else if(action==="withdraw"){
    need(me&&!s.invites.some(i=>(i.lead===me||i.partner===me)&&i.state==="accepted")&&!s.teams[me],409,"已确认的团队请联系运营处理退出。");
    s.members=s.members.filter(m=>m.id!==me);s.members.forEach(m=>{m.choices=m.choices.filter(x=>x!==me)});
    s.invites=s.invites.filter(i=>i.lead!==me&&i.partner!==me);s.meetings=s.meetings.filter(m=>m.lead!==me&&m.partner!==me);
  }else if(action==="rank"){
    need(self&&editable,409,"志愿已锁定或尚未报名。");
    const d=z.object({choices:z.array(field(80)).max(10),open:z.boolean()}).parse(data);
    need(new Set(d.choices).size===d.choices.length&&d.choices.every(id=>s.members.some(m=>m.id===id&&m.role!==self.role)),400,"名单中有无效或重复的志愿。");Object.assign(self,d);
  }else if(action==="preview"||action==="publish"){
    need(admin&&!s.published,403,"当前无法编排。");const meetings=schedule(s.members);
    if(action==="preview")return reply({meetings});
    need(meetings.length,409,"尚无双方允许的会面。");s.meetings=meetings;s.published=true;
  }else{
    need(s.published,409,"本场排班尚未发布。");
    if(action==="invite"){
      need(self?.role==="项目发起人"&&!s.submitted.includes(self.id)&&!s.teams[self.id],403,"仅尚未送审的项目方可邀请。");
      const {partner}=z.object({partner:field(80),talked:z.literal(true)}).parse(data);
      need(s.members.some(m=>m.role==="共创伙伴"&&m.id===partner)&&!s.invites.some(i=>i.partner===partner&&(i.lead===self.id||i.state==="accepted")),409,"对方已有团队或邀请已处理。");
      s.invites.push({lead:self.id,partner,state:"pending"});
    }else if(action==="respond"){
      const d=z.object({lead:field(80),accept:z.boolean()}).parse(data);
      const i=s.invites.find(i=>i.lead===d.lead&&i.partner===me&&i.state==="pending");
      need(i&&!s.submitted.includes(i.lead)&&!s.teams[i.lead],409,"邀请已处理。");
      if(d.accept){need(!s.invites.some(v=>v.partner===me&&v.state==="accepted")&&s.invites.filter(v=>v.lead===i.lead&&v.state==="accepted").length<4,409,"已达到团队人数限制。");
        s.invites.forEach(v=>{if(v!==i&&v.partner===me&&v.state==="pending")v.state="declined"});}
      i.state=d.accept?"accepted":"declined";
    }else if(action==="release"){
      const d=z.object({lead:field(80),partner:field(80)}).parse(data);
      const i=s.invites.find(i=>i.lead===d.lead&&i.partner===d.partner&&i.state==="accepted");
      need(i&&(i.lead===me||i.partner===me)&&!s.teams[i.lead],403,"仅本人可在主站团队建立前撤回本次确认。");
      s.invites=s.invites.filter(x=>x!==i);s.submitted=s.submitted.filter(l=>l!==i.lead);
    }else if(action==="submit"){
      need(me&&self?.role==="项目发起人"&&!s.teams[me]&&!s.submitted.includes(me)&&s.invites.some(i=>i.lead===me&&i.state==="accepted"),409,"请先获得至少一位共创伙伴确认。");
      s.submitted.push(me);s.invites.forEach(i=>{if(i.lead===me&&i.state==="pending")i.state="declined"});
    }else if(action==="review"){
      need(admin,403,"需要运营权限。");const d=z.object({lead:field(80),approve:z.boolean(),reason:field(400)}).parse(data);
      const lead=s.members.find(m=>m.id===d.lead);need(lead&&s.submitted.includes(lead.id)&&!s.teams[lead.id],409,"该名单尚未送审或已处理。");
      s.feedback[lead.id]=d.reason;s.submitted=s.submitted.filter(l=>l!==lead.id);
      if(d.approve){
        const team=crypto.randomUUID(),now=Date.now();s.teams[lead.id]=team;
        const insert=(key:string,k:string,owner:string,parent:string,status:string,payload:object)=>db().prepare("INSERT INTO platform_items(id,kind,owner,parent,status,payload,created,updated) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM her_entries WHERE id=? AND json_extract(data,?)=?)").bind(key,k,owner,parent,status,JSON.stringify(payload),now,now,id,'$.teams."'+lead.id+'"',team);
        const title=(lead.name+" · "+lead.topic).slice(0,120);
        extra.push(insert(team,"team",lead.account,"","active",{title,problem:lead.topic,track:"女性共创",program:id}));
        for(const invite of s.invites.filter(i=>i.lead===lead.id&&i.state==="accepted")){
          const partner=s.members.find(m=>m.id===invite.partner)!;
          extra.push(insert(crypto.randomUUID(),"invite",partner.account,team,"accepted",{name:partner.name,projectTitle:title}));
        }
      }
    }else throw new Issue(400,"未知操作。");
  }
  s.revision++;
  const update=db().prepare("UPDATE her_entries SET data=?,updated=? WHERE id=? AND kind=? AND json_extract(data,'$.revision')=?").bind(JSON.stringify(s),Date.now(),id,kind,revision);
  const [saved]=await db().batch([update,...extra]);need(saved.meta.changes,409,"场次刚有更新，请刷新后重试。");return reply({id});
}catch(e){return onError(e)}}
