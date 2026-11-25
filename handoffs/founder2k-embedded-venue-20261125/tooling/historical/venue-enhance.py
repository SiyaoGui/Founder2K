from pathlib import Path
def rep(fn,old,new):
 p=Path(fn);b=p.read_bytes();pat=old.encode();assert pat in b,(fn,old);p.write_bytes(b.replace(pat,new.encode(),1))
rep('app/api/platform/route.ts','title:text(120), track, cycle:', 'title:text(120), track, venueFormat:z.enum(["创业快闪","导师答疑","路演"]).default("创业快闪"), cycle:')
rep('app/platform.tsx','<Select name="cycle" label="工具周期"', '<Select name="venueFormat" label="会场形式" choices={["创业快闪","导师答疑","路演"]} value={row?.data.venueFormat}/><Select name="cycle" label="工具周期"')
rep('app/api/venue/source.ts','matching:boolean','matching:boolean;format:string')
rep('app/api/venue/source.ts','matching:true,meetings','matching:true,format:"女性共创",meetings')
rep('app/api/venue/source.ts',"matching:false,meetings","matching:c.venueFormat==='导师答疑',format:c.venueFormat||'创业快闪',meetings")
rep('app/api/venue/source.ts',"group:p.role==='旁听'","group:c.venueFormat==='路演'?'auditorium':c.venueFormat==='导师答疑'?'':p.role==='旁听'")
rep('app/api/venue/source.ts',"Date.parse(c.start)","Date.parse(c.start)")
rep('app/api/venue/media.ts',"service();const c=config();","const s=service(),c=config();await s.createRoom({name:room,maxParticipants:room.startsWith('pair.')?2:0,emptyTimeout:60});")
r='app/api/venue/route.ts'
rep(r,'duration:number;gap:number;wait:number','duration:number;gap:number;wait:number;bookings?:{round:number;room:number;lead:string;partner:string}[];speakers?:string[];queue?:string[];anchor?:number;extensions?:Record<string,number>')
rep(r,"'media','settings'","'media','settings','book','lineup','call','extend','requestSlot','acceptVisit','visit'")
rep(r,"round:z.number().int().min(1).max(6)", "partner:z.string().max(100).default(''),round:z.number().int().min(1).max(100)")
rep(r,'const currentRev=c.rev;',"""if(s.format==='导师答疑'){
    s.meetings=c.bookings||[];
    for(const m of s.meetings){const lead=s.people.find(p=>p.id===m.lead),visitor=s.people.find(p=>p.id===m.partner);if(lead)lead.group=lead.id;if(visitor&&!visitor.group)visitor.group=m.lead}
  }
  const currentRev=c.rev;""")
rep(r,'const first=s.start+600000','const first=c.anchor??(s.start+600000)')
rep(r,"const own=s.meetings", """const end=(m:{round:number;lead:string;partner:string})=>c.extensions?.[mid(m)]??(begin(m.round)+c.duration*60000);
  const own=s.meetings""")
rep(r,"now<begin(m.round)+c.duration*60000","now<end(m)")
rep(r,"'delegate','settings'].includes","'delegate','settings','book','lineup','call','extend'].includes")
rep(r,"if(a.action==='notify')c.notice=a.text;", """if(a.action==='book'){
      need(s.format==='导师答疑'&&a.group!==a.partner&&person(a.group)&&person(a.partner),400,'请选择导师与预约人');
      const list=c.bookings??=[];
      need(!list.some(m=>m.round===a.round&&[m.lead,m.partner].some(id=>[a.group,a.partner].includes(id))),409,'本轮已有预约');
      if(!list.length)c.anchor=now+60000;
      need((c.anchor??first)+(a.round-1)*(c.duration+c.gap)*60000>now,409,'此时段已开始');
      list.push({round:a.round,room:0,lead:a.group,partner:a.partner});
      c.groups[a.group]??={mode:'stage',manager:a.group,epoch:crypto.randomUUID(),handoff:0};
    }else if(a.action==='lineup'||a.action==='call'){
      need(s.format==='路演'&&person(a.text)?.role==='参与者',400,'请选择正式参加者');
      const queue=c.queue??=[],speakers=c.speakers??=[];
      if(a.action==='lineup'){need(!queue.includes(a.text)&&!speakers.includes(a.text),409,'已在候场或台上');queue.push(a.text)}
      else {need(queue[0]===a.text&&speakers.length<10,409,'轮到下一位或已达到舞台上限');queue.shift();speakers.push(a.text)}
    }else if(a.action==='extend'){
      const m=s.meetings.find(m=>m.round===a.round&&m.lead===a.group),l=m&&live.find(l=>l.id===mid(m));
      need(m&&l?.media_generation&&end(m)>now,409,'当前会谈无法延长');
      const until=end(m)+60000;
      need(!s.meetings.some(q=>q.round>m.round&&begin(q.round)<until&&(q.lead===m.lead||q.partner===m.partner)),409,'延长会占用后续预约，请先协调补谈');
      (c.extensions??={})[mid(m)]=until;
      c.rev++;
      const [written]=await sql.batch([sql.prepare("UPDATE her_entries SET data=?,updated=? WHERE id=? AND json_extract(data,'$.rev')=?").bind(JSON.stringify(c),now,key,currentRev),
        sql.prepare("UPDATE venue_meetings SET planned_end_ms=? WHERE id=? AND media_closed_ms IS NULL AND changes()=1").bind(until,mid(m))]);
      need(written.meta.changes,409,'其他调度员已更新安排');return reply({ok:true});
    }else if(a.action==='notify')c.notice=a.text;""")
rep(r,"return reply({title:s.title","return reply({format:s.format,queueAhead:(c.queue||[]).indexOf(me),onStage:(c.speakers||[]).includes(me),queue:admin?c.queue||[]:[],title:s.title")
rep(r,"grant(stage(group),me,name,false,true)","grant(stage(group),me,name,s.format==='路演'&&!!c.speakers?.includes(me),true)")
rep(r,"length:s.matching?6:0","length:s.format==='导师答疑'?Math.max(0,...own.map(m=>m.round)):s.matching?6:0")
rep(r,"const slot={round:r,start:begin(r),end:begin(r)+c.duration*60000}","const slot={round:r,start:begin(r),end:m?end(m):begin(r)+c.duration*60000}")
rep(r,"self?.role==='项目发起人'?me","self?.role==='项目发起人'||s.format==='导师答疑'&&s.meetings.some(m=>m.lead===me)?me")
rep(r,'list[0],l=live','list.sort((a,b)=>a.round-b.round)[0],l=live')
rep(r,'active:l?[l.host_account','round:l?Number(l.id.split(\'.\')[1]):0,active:l?[l.host_account')
rep(r,"const manager=pres.get(g.manager);need(manager", "const manager=pres.get(g.manager==='host'&&admin?me:g.manager);need(manager")
rep(r,"person(id)?.name||s.people.find","person(id)?.name||(id==='auditorium'?'路演舞台':'')||s.people.find")
rep(r,"media:boolean","media:boolean") if False else None
# Recheck the active device after takeover, including after a failed pulse.
rep('app/venue/venue.tsx',"await request('pulse');pulse.current=Date.now()", "pulse.current=Date.now();try{await request('pulse')}finally{await refresh()}")
rep('app/venue/venue.tsx','type View={title:string;', 'type View={format:string;onStage:boolean;queueAhead:number;queue:string[];title:string;')
rep('app/venue/venue.tsx','type Group={id:string;', 'type Group={round:number;id:string;')
rep('app/venue/venue.tsx',"[sub,setSub]=useState('host')","[sub,setSub]=useState('host'),[guest,setGuest]=useState(''),[round,setRound]=useState(1)")
rep('app/venue/venue.tsx','<MediaPanel channel=',""" {v.format==='路演'&&<p>{v.onStage?'已获准上台发言':v.queueAhead>=0?'候场中 · 前面还有 '+v.queueAhead+' 位':'观众席'}</p>}
    <MediaPanel channel=""")
rep('app/venue/venue.tsx','<div className="venue-actions">{[[',""" {v.format==='导师答疑'&&<fieldset><legend>安排导师预约</legend><label>来访者<select value={guest} onChange={e=>setGuest(e.target.value)}><option value="">请选择</option>{v.helpers.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></label>
    <label>时段序号<input type="number" min={1} max={100} value={round} onChange={e=>setRound(Number(e.target.value))}/></label><button onClick={()=>action('book',{group:sub,partner:guest,round})}>预约所选导师</button></fieldset>}
    {v.format==='路演'&&<><button onClick={()=>action('lineup',{text:sub})}>加入候场队列</button><button disabled={!v.queue.length} onClick={()=>action('call',{text:v.queue[0]})}>邀请下一位上台</button></>}
    <div className="venue-actions">{[[""")
rep('app/venue/venue.tsx','{g.help.map','{v.admin&&g.active&&<button onClick={()=>{if(confirm("将延长 "+g.active+" 的会谈一分钟；后续有冲突时将取消。"))void action("extend",{group:g.id,round:g.round})}}>延长一分钟</button>}{g.help.map')
rep('app/venue/venue.tsx',"v.matching?'/#women/program?id='","v.format==='女性共创'?'/#women/program?id='")
