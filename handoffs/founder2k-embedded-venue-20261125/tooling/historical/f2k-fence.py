from pathlib import Path
p=Path('app/api/venue/media.ts');s=p.read_text().replace("const s=service(),c=config();await s.createRoom({name:room,maxParticipants:room.startsWith('pair.')?2:0,emptyTimeout:60});","const s=service(),c=config();\n  if(room.startsWith('pair.'))requireVenue((await s.listRooms([room])).length,409,'会谈媒体已关闭，请结束本轮或申请补谈');\n  else await s.createRoom({name:room,emptyTimeout:60});")
s+="""
export async function preparePair(){
  const row=await env.DB!.prepare("SELECT updated FROM her_entries WHERE id='venue/clock' AND kind='venue-clock'").first<{updated:number}>();
  requireVenue(row&&Date.now()-row.updated<15000,503,'截止调度服务离线，请稍后进入');
  const name='pair.'+crypto.randomUUID();
  await service().createRoom({name,maxParticipants:2,emptyTimeout:120,departureTimeout:60});
  return name;
}
"""
p.write_text(s)
p=Path('app/api/venue/maintenance/route.ts');s=p.read_text().replace("  return Response.json", """  await db.prepare("INSERT INTO her_entries(id,kind,author,target,state,data,updated) VALUES('venue/clock','venue-clock','system','','private','{}',?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated WHERE updated < excluded.updated-5000").bind(Date.now()).run();
  return Response.json""");p.write_text(s)
p=Path('app/api/venue/route.ts');s=p.read_text().replace('grant,service,closeRoom','grant,service,closeRoom,preparePair')
s=s.replace("if(!l?.media_generation){\n      try{", "if(!l?.media_generation){\n      const media=await preparePair();try{").replace("bind(keyId,'pair.'+crypto.randomUUID())","bind(keyId,media)").replace("catch{throw new VenueError(409,'双方需先离开", "catch{await closeRoom(media);throw new VenueError(409,'双方需先离开")
s=s.replace("need(!prior?.media_closed_ms,409,'这场会面已结束');","need(!prior?.media_closed_ms,409,'这场会面已结束');\n      const media=await preparePair();")
s=s.replace("bind(id,'pair.'+crypto.randomUUID(),key,currentRev)", "bind(id,media,key,currentRev)").replace("catch{throw new VenueError(409,'上一场收尾中", "catch{await closeRoom(media);throw new VenueError(409,'上一场收尾中")
p.write_text(s)
