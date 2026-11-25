from pathlib import Path
exec(Path('/tmp/venue-enhance.py').read_text().split("rep('app/api/platform")[0])
r='app/api/venue/route.ts';u='app/venue/venue.tsx'
rep(r,"anchor?:number;extensions?", "anchor?:number;visits?:Record<string,{group:string;approved:boolean}>;offsets?:Record<string,number>;extensions?")
rep(r,"automatic:boolean};","automatic:boolean;joined?:string;skipped?:string[]};")
rep(r,"'acceptVisit','visit'","'acceptVisit','visit','shift','offstage','resolve'")
rep(r,"'auto"+"matic:z.boolean()", "'automatic:z.boolean()") if False else None
rep(r,"const end=(m:", "const starts=(m:{round:number;lead:string;partner:string})=>begin(m.round)+(c.offsets?.[mid(m)]||0);\n  const end=(m:")
rep(r,'??(begin(m.round)+c.duration*60000)','??(starts(m)+c.duration*60000)')
rep(r,"const own=s.meetings.filter", "const own=s.meetings.filter")
rep(r,"&&!live.find(l=>l.id===mid(m))?.media_closed_ms&&p?.skip!==mid(m)", "&&!live.find(l=>l.id===mid(m))?.media_closed_ms&&p?.skip!==mid(m)&&!p?.skipped?.includes(mid(m))")
rep(r,"const group=self?", "const visit=c.visits?.[me];\n  const group=visit?.approved&&!s.matching?visit.group:self?")
rep(r,"skip:p?.skip||'',automatic","skip:p?.skip||'',skipped:p?.skipped||[],automatic")
rep(r,"const fields:Record", """if(a.action==='skip')await sql.prepare("UPDATE her_entries SET data=json_set(data,'$.skipped',json(?)) WHERE id=? AND json_extract(data,'$.device')=?").bind(JSON.stringify([...new Set([...(p.skipped||[]),mid(meeting!)])]),key+'/'+me,a.device).run();
    const fields:Record""")
rep(r,"if(['notify'", """if(['visit','acceptVisit','requestSlot','resolve'].includes(a.action)){
    need(a.revision===c.rev,409,'安排有更新，请重试');
    const g=c.groups[a.group];need(g,404,'找不到分组');
    if(a.action==='visit'){
      need(!s.matching&&s.format==='创业快闪'&&self&&self.role!=='旁听'&&!active,403,'当前无法申请巡组');
      (c.visits??={})[me]={group:a.group,approved:false};await changes();
    }else if(a.action==='acceptVisit'){
      const visit=c.visits?.[a.text];
      need((admin||g.manager===me||self?.group===a.group)&&visit?.group===a.group,403,'仅本组可接待申请人');visit.approved=true;await changes();
    }else if(a.action==='requestSlot'){
      need(g.manager===me||admin,403,'需要分组权限');
      await sql.prepare("UPDATE her_entries SET data=json_set(data,'$.help',?) WHERE id=?").bind('申请补位 · '+a.text,key+'/'+me).run();
    }else{
      need(admin||g.manager===me,403,'需要管理权限');
      const assisted=person(a.text);need(assisted&&(admin||assisted.group===a.group||s.meetings.some(m=>m.lead===a.group&&m.partner===assisted.id)),403,'不在本组');
      await sql.prepare("UPDATE her_entries SET data=json_set(data,'$.help','') WHERE id=?").bind(key+'/'+a.text).run();
    }return reply({ok:true});
  }
  if(['notify'""")
rep(r,"'call','extend'].includes", "'call','extend','shift','offstage'].includes")
rep(r,"if(a.action==='book'){", """if(a.action==='offstage'){
      need(c.speakers?.includes(a.text),409,'成员已下台');c.speakers=c.speakers.filter(id=>id!==a.text);
      await changes();if(available())await service().removeParticipant(stage('auditorium'),a.text);return reply({ok:true});
    }else if(a.action==='shift'){
      const m=s.meetings.find(m=>m.round===a.round&&m.lead===a.group);
      need(m&&!live.some(l=>l.id===mid(m)),409,'只能调整尚未开始的会面');
      const offset=a.delay*1000,from=begin(m.round)+offset,to=from+c.duration*60000;
      need(to>now&&!s.meetings.some(q=>q!==m&&(q.lead===m.lead||q.partner===m.partner)&&starts(q)<to&&end(q)>from),409,'调整会与其他约谈冲突');
      (c.offsets??={})[mid(m)]=offset;
    }else if(a.action==='book'){""")
rep(r,"g.manager=a.text;continue","g.manager=a.text==='host'?me:a.text;continue")
rep(r,"if(available())await closeRoom('team.'+a.id+'.'+prior[k].epoch);", "if(available())await closeRoom((prior[k].mode==='stage'?'presentation.':'team.')+a.id+'.'+prior[k].epoch);")
rep(r,"begin(m.round)+c.duration*60000>now", "end(m)>now")
rep(r,"if(now<begin(a.round)){","if(now<starts(meeting)){")
rep(r,"need(now<begin(a.round)+c.duration*60000","need(now<end(meeting)")
rep(r,"begin(a.round),begin(a.round)+c.duration*60000","begin(a.round),end(meeting)")
rep(r,"return reply({ok:true});\n  }\n  if(a.action==='media')", """const held=await sql.prepare('SELECT meeting_id FROM venue_admissions WHERE meeting_id=?').bind(id).first();
    need(held,409,'调度刚刚变化，请重新确认');
    await sql.prepare("UPDATE her_entries SET data=json_set(data,'$.joined',?) WHERE id=? AND json_extract(data,'$.device')=?").bind(id,key+'/'+me,a.device).run();
    return reply({ok:true});
  }
  if(a.action==='media')""")
rep(r,"if(active&&active.planned_end_ms", "if(active&&(p?.joined===active.id||p?.early===active.id||p?.automatic)&&active.planned_end_ms")
rep(r,"const slot={round:r,start:begin(r)","const slot={round:r,planned:begin(r),start:m?starts(m):begin(r)")
rep(r,"skipped:p?.skip===mid(m)","skipped:p?.skip===mid(m)||p?.skipped?.includes(mid(m))")
rep(r,"mediaKey:active?.media_generation||","mediaKey:(active&&(p?.joined===active.id||p?.early===active.id||p?.automatic)?active.media_generation:null)||")
rep(r,"active:active?.id,current:", "active:active&&(p?.joined===active.id||p?.early===active.id||p?.automatic)?active.id:null,current:")
rep(r,".map(p=>p.name+'：'+pres.get(p.id)!.help)",".map(p=>({id:p.id,text:p.name+' · '+pres.get(p.id)!.help}))")
rep(r,"rooms,group,mode:","rooms,group,visits:Object.entries(c.visits||{}).filter(([,v])=>admin||self?.group===v.group||c.groups[v.group]?.manager===me).map(([id,v])=>({member:id,name:person(id)?.name,...v})),visitOptions:s.format==='创业快闪'&&self?.role!=='旁听'?Object.keys(c.groups).filter(k=>!['lobby','audience',self?.group].includes(k)).map(id=>({id,label:s.people.find(p=>p.group===id)?.topic||'团队'})):[],mode:")
rep(r,"round:l?Number(l.id.split('.')[1]):0,", "scheduledRound:m?.round,round:l?Number(l.id.split('.')[1]):0,")
rep(u,"help:string[]","scheduledRound?:number;help:{id:string;text:string}[]")
rep(u,"type Slot={round:number;", "type Slot={planned:number;round:number;")
rep(u,"type View={format:", "type View={visits:{member:string;group:string;name:string;approved:boolean}[];visitOptions:{id:string;label:string}[];format:")
rep(u,"<small>原计划 {time(s.start)}–{time(s.end)}</small>", "<small>原计划 {time(s.planned)}{s.start!==s.planned?' · 调整至 '+time(s.start):''} · 截止 {time(s.end)}</small>")
rep(u,"{g.help.map((h,i)=><small key={i}>{h}</small>)}","""{g.help.map(h=><p key={h.id}>{h.text} <button onClick={()=>action('resolve',{group:g.id,text:h.id})}>已处理</button></p>)}
    <button onClick={()=>action('requestSlot',{group:g.id,text:g.next||'待安排'})}>申请补位</button>
    {v.admin&&g.scheduledRound&&!g.active&&<button onClick={()=>{if(confirm('将 '+g.label+' 与 '+g.next+' 的会面推迟一分钟？'))void action('shift',{group:g.id,round:g.scheduledRound,delay:60})}}>调整下一场</button>}""")
rep(u,"{v.rooms.length>0&&<section", """{v.visitOptions.length>0&&<details><summary>申请导师巡组</summary>{v.visitOptions.map(g=><button key={g.id} onClick={()=>action('visit',{group:g.id})}>申请加入{g.label}</button>)}</details>}
    {v.visits.map(t=><p key={t.member}>{t.name} · {t.approved?'已获准巡组':'申请巡组'} {!t.approved&&<button onClick={()=>action('acceptVisit',{group:t.group,text:t.member})}>允许加入</button>}</p>)}
    {(v.rooms.length>0||v.admin)&&<section""")
rep(u,"<label>替补主持<select", "<label>分组主持或预约导师<select")
rep(u,"<button onClick={()=>action('lineup'", "<button onClick={()=>action('offstage',{text:sub})}>结束所选成员展示</button><button onClick={()=>action('lineup'")
rep(u,"<label>全场文字通知", """<details><summary>轮转与超时设置</summary><form onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);void action('settings',{duration:Number(d.get('duration')),gap:Number(d.get('gap')),wait:Number(d.get('wait'))})}}><label>每轮分钟<input name="duration" type="number" defaultValue={15} min={1} max={180}/></label><label>间隔分钟<input name="gap" type="number" defaultValue={2} min={0} max={60}/></label><label>等待告警秒数<input name="wait" type="number" defaultValue={v.wait} min={10} max={1800}/></label><button>保存</button></form></details><label>全场文字通知""")
