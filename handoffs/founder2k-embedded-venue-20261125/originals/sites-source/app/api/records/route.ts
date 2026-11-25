import { getChatGPTUser } from '../../chatgpt-auth';
import {getDb} from '../../../db';
import {records} from '../../../db/schema';
import {and,eq,desc} from 'drizzle-orm';
const kinds=['application','project','bookmark','support','callback'];
export async function GET(){const user=await getChatGPTUser();if(!user)return Response.json({error:'请先登录'}, {status:401});try{return Response.json(await getDb().select().from(records).where(eq(records.owner,user.userId)).orderBy(desc(records.updated)))}catch{return Response.json({error:'记录暂时无法读取，请稍后重试'}, {status:503})}}
export async function POST(req:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'请先登录'}, {status:401});
 if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'来源不匹配'},{status:403});
 const raw=await req.text();if(raw.length>20000)return Response.json({error:'内容过长'},{status:413});
 let body:any;try{body=JSON.parse(raw)}catch{return Response.json({error:'格式错误'},{status:400})}
 if(!kinds.includes(body.kind)||!body.payload||typeof body.payload!=='object'||Array.isArray(body.payload))return Response.json({error:'记录类型无效'},{status:400});
 const id=body.id||crypto.randomUUID();if(typeof id!=='string'||id.length>100)return Response.json({error:'编号无效'},{status:400});
 const p=body.payload;
 if(body.kind==='application'&&(!p.name||!p.email||!p.consent))return Response.json({error:'请填写姓名、邮箱并同意使用说明'},{status:400});
 if(body.kind==='project'&&(!p.title||typeof p.title!=='string'||p.title.length>200))return Response.json({error:'项目名称不能为空或超过200字'},{status:400});
 try{const db=getDb();const old=await db.select().from(records).where(eq(records.id,id)).limit(1);if(old.length&&old[0].owner!==user.userId)return Response.json({error:'无权修改'},{status:403});
 const item={id,owner:user.userId,kind:body.kind,payload:JSON.stringify(p),updated:Date.now()};
 if(old.length)await db.update(records).set({payload:item.payload,updated:item.updated}).where(and(eq(records.id,id),eq(records.owner,user.userId)));else await db.insert(records).values(item);
 return Response.json({id,ok:true});}catch{return Response.json({error:'保存失败，内容仍留在当前页面，请重试'},{status:503})}
}
export async function DELETE(req:Request){const user=await getChatGPTUser();if(!user)return Response.json({error:'请先登录'},{status:401});if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'来源不匹配'},{status:403});const id=new URL(req.url).searchParams.get('id');if(!id)return Response.json({error:'缺少编号'},{status:400});try{await getDb().delete(records).where(and(eq(records.id,id),eq(records.owner,user.userId)));return Response.json({ok:true})}catch{return Response.json({error:'删除失败'},{status:503})}}
