import {env} from "cloudflare:workers";
import {z} from "zod";
import {getChatGPTUser} from "../../chatgpt-auth";
import {starterLessons} from "../../platform-content";

export const dynamic="force-dynamic";
type Row={id:string;kind:string;author:string;target:string;state:string;updated:number;data:string};
const str=(n:number)=>z.string().trim().min(1).max(n);
const short=z.string().trim().max(500).default("");
const link=z.union([z.literal(""),z.string().url().max(1000).refine(x=>x.startsWith("https://"))]).default("");
const db=()=>env.DB!;
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
class Failure extends Error{constructor(public status:number,msg:string){super(msg)}}
function check(ok:unknown,status:number,msg:string):asserts ok {if(!ok)throw new Failure(status,msg)}
function failure(e:unknown){return e instanceof Failure?reply({error:e.message},e.status):e instanceof z.ZodError||e instanceof SyntaxError?reply({error:"请核对必填字段、内容长度与 HTTPS 链接。"},400):reply({error:"暂时无法保存或读取，请重试。"},503)}
async function key(...parts:string[]){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(parts)))),b=>b.toString(16).padStart(2,"0")).join("")}
async function actor(){
  const u=await getChatGPTUser();check(u,401,"请先登录");
  return {me:await key("her-member",u.userId),admin:(env.FOUNDER2K_ADMIN_EMAIL||(import.meta.env.DEV?"seedy@sites.test":"")).toLowerCase()===u.email.toLowerCase(),email:u.email};
}
async function get(id:string,kind:string){const r=await db().prepare("SELECT * FROM her_entries WHERE id=? AND kind=?").bind(id,kind).first<Row>();check(r,404,"此内容不可用");return r}
async function write(kind:string,author:string,target:string,state:string,data:object,id:string=crypto.randomUUID(),update=false){
  const conflict=update?" ON CONFLICT(id) DO UPDATE SET data=excluded.data,state=excluded.state,updated=excluded.updated WHERE author=excluded.author AND kind=excluded.kind":" ON CONFLICT(id) DO NOTHING";
  await db().prepare("INSERT INTO her_entries(id,kind,author,target,state,data,updated) VALUES(?,?,?,?,?,?,?)"+conflict).bind(id,kind,author,target,state,JSON.stringify(data),Date.now()).run();return {id};
}
const shared="(kind IN ('profile','post','project','lesson','comment') AND state='listed')";
export async function GET(request:Request){try{
  const {me,admin}=await actor();const thread=new URL(request.url).searchParams.get("thread");
  if(thread){const t=await get(thread,"thread");check(t.author===me||t.target===me,403,"没有此会话的访问权");const rows=await db().prepare("SELECT * FROM her_entries WHERE kind='message' AND target=? ORDER BY updated,id").bind(thread).all<Row>();return reply(rows.results.map(r=>({...r,data:JSON.parse(r.data)})))}
  const rows=await db().prepare("SELECT * FROM her_entries WHERE "+shared+" OR (kind NOT IN ('message','comment') AND author=?) OR (kind='thread' AND target=?) OR (?=1 AND kind='ticket') ORDER BY updated DESC,id").bind(me,me,admin?1:0).all<Row>();
  return reply({me,admin,rows:rows.results.map(r=>({...r,data:JSON.parse(r.data)}))});
}catch(e){return failure(e)}}

export async function POST(request:Request){try{
  const {me,admin,email}=await actor();const origin=request.headers.get("origin");check(origin===new URL(request.url).origin,403,"请求来源无效");
  const {action,data:d}=z.object({action:str(40),data:z.record(z.unknown())}).parse(await request.json());
  if(action==="profile"){
    const {listed,...data}=z.object({name:str(80),role:z.enum(["创业者","导师","投资者"]),skills:short,location:short,languages:short,focus:short,sector:short,round:short,bio:z.string().trim().max(1500),link,listed:z.boolean(),contact:z.boolean()}).parse(d);
    return reply(await write("profile",me,"",listed?"listed":"private",data,me,true));
  }
  if(action==="subscribe"){const {enabled}=z.object({enabled:z.boolean()}).parse(d);return reply(await write("subscription",me,"",enabled?"active":"off",enabled?{email}:{},await key("mail",me),true))}
  if(action==="ticket"){const data=z.object({title:str(150),body:str(2500)}).parse(d);return reply(await write("ticket",me,"","pending",data))}
  if(action==="answer"){check(admin,403,"需要运营权限");const {id,body}=z.object({id:str(100),body:str(2500)}).parse(d);const t=await get(id,"ticket");return reply(await write(t.kind,t.author,"","answered",{...JSON.parse(t.data),answer:body},id,true))}
  if(action==="lesson"){check(admin,403,"需要运营权限");const data=z.object({title:str(150),body:str(5000),exercise:str(1500),level:z.enum(["入门","实践","进阶"]),video:link}).parse(d);return reply(await write("lesson",me,"","listed",data))}
  if(action==="progress"||action==="comment"){
    const id=str(100).parse(d.id);const target=z.enum(["post","lesson"]).parse(d.kind);
    if(target==="post"||!starterLessons.some(l=>l.id===id)){const r=await get(id,target);check(r.state==="listed",404,"内容不可用")}
    if(action==="progress"){check(target==="lesson",400,"请选择课程");return reply(await write("progress",me,id,"done",{},await key("learn",me,id),true))}
    await get(me,"profile");return reply(await write("comment",me,id,"listed",{body:str(1800).parse(d.body)}));
  }
  if(action==="threadState"||action==="message"){
    const id=str(100).parse(d.id);const t=await get(id,"thread");check(t.author===me||t.target===me,403,"没有此会话的访问权");
    if(action==="message"){const body=str(2400).parse(d.body);const mid=crypto.randomUUID();const result=await db().prepare("INSERT INTO her_entries SELECT ?, 'message', ?, id, 'private', ?, ? FROM her_entries WHERE id=? AND kind='thread' AND state='accepted' AND (author=? OR target=?)").bind(mid,me,JSON.stringify({body}),Date.now(),id,me,me).run();check(result.meta.changes,409,"会话尚未开放或已经关闭");return reply({id:mid})}
    const state=z.enum(["accepted","closed"]).parse(d.state);check(state==="closed"||t.target===me,403,"由收件人接受请求");const change=await db().prepare("UPDATE her_entries SET state=?,updated=? WHERE id=? AND state=?").bind(state,Date.now(),id,state==="accepted"?"pending":t.state).run();check(change.meta.changes,409,"状态已变化");return reply({id});
  }
  await get(me,"profile");
  if(action==="thread"||action==="follow"){
    const target=str(100).parse(d.id);const p=await get(target,"profile");check(target!==me&&p.state==="listed",409,"无法联系此档案");
    if(action==="follow")return reply(await write("follow",me,target,z.boolean().parse(d.enabled)?"active":"off",{},await key("follow",me,target),true));
    check(JSON.parse(p.data).contact,409,"对方暂不接收联系");return reply(await write("thread",me,target,"pending",{body:str(1400).parse(d.body)},await key("thread",...[me,target].sort())));
  }
  if(action==="post"){const data=z.object({title:str(150),body:str(4000),category:z.enum(["找共创","求反馈","项目进展"])}).parse(d);return reply(await write("post",me,"","listed",data))}
  if(action==="project"){const {listed,...data}=z.object({title:str(150),body:str(3000),need:short,team:short,stage:short,link,listed:z.boolean()}).parse(d);const id=d.id===undefined?crypto.randomUUID():str(100).parse(d.id);if(d.id)check((await get(id,"project")).author===me,403,"仅负责人可修改");return reply(await write("project",me,"",listed?"listed":"private",data,id,true))}
  throw new Failure(400,"无法识别该操作");
}catch(e){return failure(e)}}
