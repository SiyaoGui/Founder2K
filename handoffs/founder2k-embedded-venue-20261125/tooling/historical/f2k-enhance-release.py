from pathlib import Path
p=Path('app/api/venue/route.ts');s=p.read_text()
s=s.replace("handoff:number};","handoff:number;closing?:{oldRoom:string}};")
s=s.replace("anchor?:number;visits?","verified?:string[];formerSpeakers?:string[];followups?:Record<string,{from:string;to:string;choice:string;agreed:boolean}>;anchor?:number;visits?")
s=s.replace("'offstage','resolve'","'offstage','resolve','verify','follow','respondFollow'")
s=s.replace("const current=own.find", "const privateFollow=active&&s.format==='路演'&&active.logical_room.startsWith('follow/');\n  const current=own.find")
s=s.replace("if(a.action==='check'){","""// A recall is durable before remote cleanup. Retries close the old generation
  // before any client receives the replacement room.
  const closing=Object.entries(c.groups).filter(([,g])=>g.closing);
  if(closing.length){
    for(const [id,g] of closing){
      if(available())await closeRoom(g.closing!.oldRoom);
      for(const l of live.filter(l=>l.logical_room===id&&l.media_generation))await close(l);
      delete g.closing;
    }
    await changes();return reply({retry:true});
  }
  if(a.action==='check'){""")
s=s.replace("if(['visit','acceptVisit'", """if(a.action==='follow'||a.action==='respondFollow'){
    need(self&&p&&c.rev===a.revision,409,'请按最新议程操作');
    const choices=c.followups??={};const peer=person(a.partner);need(peer&&peer.id!==me,400,'请选择对方');
    const pair=[me,peer.id].sort().join('.'),item=choices[pair];
    if(a.action==='follow'){
      need(['补谈','试合作'].includes(a.text),400,'请选择后续安排');
      const met=own.some(m=>(m.lead===peer.id||m.partner===peer.id)&&live.some(l=>l.id===mid(m)&&l.media_connected_ms&&l.media_closed_ms));
      need(met||s.format==='路演'&&c.formerSpeakers?.includes(peer.id),403,'当前不能申请会后交流');
      need(!item,409,'已有意向待处理');choices[pair]={from:me,to:peer.id,choice:a.text,agreed:false};
    }else{
      need(item&&item.from===peer.id&&item.to===me&&!item.agreed,409,'没有待处理的邀请');
      if(a.text==='同意')item.agreed=true;else delete choices[pair];
    }
    await changes();return reply({ok:true});
  }
  if(['visit','acceptVisit'""")
s=s.replace("'extend','shift','offstage'].includes","'extend','shift','offstage','verify'].includes")
s=s.replace("if(a.action==='offstage'){","""if(a.action==='verify'){
      need(person(a.text),400,'请选择已签到成员');need(pres.has(a.text),409,'尚未签到');
      c.verified=[...new Set([...(c.verified||[]),a.text])];await changes();await audit('verify',{subject:a.text}).run();return reply({ok:true});
    }else if(a.action==='offstage'){""")
s=s.replace("c.speakers=(c.speakers||[]).filter(id=>id!==a.text);","c.speakers=(c.speakers||[]).filter(id=>id!==a.text);c.formerSpeakers=[...new Set([...(c.formerSpeakers||[]),a.text])];")
s=s.replace("g.mode='stage';g.epoch=crypto.randomUUID();g.handoff=0;", "g.closing={oldRoom:(g.mode==='stage'?stage(k):team(k))};g.mode='stage';g.epoch=crypto.randomUUID();g.handoff=0;")
start=s.index("    if(a.action==='restore'||a.action==='recall'){");end=s.index("    return reply({ok:true});",start);s=s[:start]+s[end:]
s=s.replace("const slot={round:r,planned:","const slot={round:r,planned:").replace("id:mid(m),name:person(other)?.name","id:mid(m),peer:other,name:person(other)?.name,verified:c.verified?.includes(other)")
s=s.replace("mode:g.mode,handoff:g.handoff", "mode:g.mode,handoff:g.handoff")
s=s.replace("return reply({format:s.format,", """const followups=Object.values(c.followups||{}).filter(f=>f.from===me||f.to===me).map(f=>{
    const peer=f.from===me?f.to:f.from;return {peer,name:person(peer)?.name,received:f.to===me,choice:f.choice,agreed:f.agreed};
  });
  return reply({verified:!!c.verified?.includes(me),followups,pitchContacts:s.format==='路演'?(c.formerSpeakers||[]).map(id=>({id,name:person(id)?.name})):[],format:s.format,""")
s=s.replace("if(a.action==='admit'){","""if(a.action==='admit'&&s.format==='路演'&&a.partner){
    const other=person(a.partner),pair=[me,a.partner].sort().join('.');
    need(self&&p&&other&&c.followups?.[pair]?.agreed,403,'请先取得双方同意');
    const keyId=[a.id,0,...pair.split('.')].join('.'),l=live.find(row=>row.id===keyId);
    need(!l?.media_closed_ms&&available(),409,'会后交流不可用');
    if(!l?.media_generation){
      try{await sql.batch([sql.prepare('INSERT OR IGNORE INTO venue_meetings VALUES(?,?,?,?,?,?,?,?,NULL,NULL)').bind(keyId,a.id,keyId,'follow/'+pair,self.account,other.account,now,now+c.duration*60000),
        sql.prepare('INSERT INTO venue_admissions VALUES(?,?)').bind(keyId,'pair.'+crypto.randomUUID())])}catch{throw new VenueError(409,'双方需先离开其他会谈')}
    }
    await sql.prepare("UPDATE her_entries SET data=json_set(data,'$.joined',?) WHERE id=? AND json_extract(data,'$.device')=?").bind(keyId,key+'/'+me,a.device).run();return reply({ok:true});
  }
  if(a.action==='admit'){""")
s=s.replace("c.groups[active.logical_room]?.mode==='discussion'","(privateFollow||c.groups[active.logical_room]?.mode==='discussion')")
p.write_text(s)
p=Path('app/venue/venue.tsx');s=p.read_text().replace('type Slot={planned:', 'type Slot={peer?:string;verified?:boolean;planned:').replace('type View={visits:', 'type View={verified:boolean;pitchContacts:{id:string;name:string}[];followups:{peer:string;name:string;received:boolean;choice:string;agreed:boolean}[];visits:')
s=s.replace('· {v.role} · 本人声明','· {v.role} · {v.verified?"已核验":"本人声明"}')
s=s.replace('<span>{s.closed?', '''{s.closed&&s.actual&&<button onClick={()=>action('follow',{partner:s.peer,text:'试合作'})}>邀请试合作</button>}{s.closed&&s.actual&&<button onClick={()=>action('follow',{partner:s.peer,text:'补谈'})}>邀请补谈</button>}<span>{s.closed?''')
s=s.replace('{v.visits.map', """{v.pitchContacts.map(t=><button key={t.id} onClick={()=>action('follow',{partner:t.id,text:'补谈'})}>邀请{t.name}会后交流</button>)}
    {v.followups.map(f=><article key={f.peer}>{f.name} · {f.choice} · {f.agreed?'双方已同意':f.received?'对方邀请你':'等待对方回应'}
    {f.received&&!f.agreed&&<><button onClick={()=>action('respondFollow',{partner:f.peer,text:'同意'})}>同意</button><button onClick={()=>action('respondFollow',{partner:f.peer,text:'婉拒'})}>婉拒</button></>}
    {f.agreed&&v.format==='路演'&&<button onClick={()=>action('admit',{partner:f.peer})}>与{f.name}私下交流</button>}</article>)}
    {v.active&&!current&&<button onClick={()=>action('end')}>结束私下交流</button>}
    {v.visits.map""")
s=s.replace('{v.format===\'导师答疑\'&&<fieldset>',"""<button disabled={sub==='host'} onClick={()=>{if(confirm('已完成该成员的身份核验？'))void action('verify',{text:sub})}}>标记姓名已核验</button>{v.format==='导师答疑'&&<fieldset>""")
p.write_text(s)
