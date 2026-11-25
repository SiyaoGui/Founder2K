export type Role = "项目发起人" | "共创伙伴";
export type Member = {id:string; name:string; role:Role; topic:string; availability:string; open:boolean; choices:string[]};
export type Meeting = {round:number; room:number; lead:string; partner:string};
export const rounds = 6;
export const capacity = {"项目发起人":8, "共创伙伴":16};

// The pilot has at most eight rooms. A bit mask records which rooms are used
// in a round. Each partner contributes at most one edge to the winning plan.
export function schedule(members:Member[]):Meeting[] {
  const ordered = [...members].sort((a,b)=>a.id.localeCompare(b.id));
  const leads = ordered.filter(p=>p.role==="项目发起人");
  const partners = ordered.filter(p=>p.role==="共创伙伴");
  if(leads.length>capacity["项目发起人"] || partners.length>capacity["共创伙伴"]) throw Error("超出本场容量");
  const meetings:Meeting[] = [];
  const count = new Map<string,number>();
  const seen = new Set<string>();
  for(let round=1;round<=rounds;round++){
    let states = new Map<number,{score:number; pairs:Meeting[]}>([[0,{score:0,pairs:[]}]]);
    for(const partner of partners){
      const next = new Map(states);
      for(const [mask,state] of states){
        for(const [room,lead] of leads.entries()){
          const bit=1<<room;
          if((mask&bit) || seen.has(lead.id+"/"+partner.id)) continue;
          const a=lead.choices.indexOf(partner.id), b=partner.choices.indexOf(lead.id);
          if((a<0 && !lead.open)||(b<0 && !partner.open)) continue;
          const l=count.get(lead.id)||0, p=count.get(partner.id)||0;
          const coverage=(l===0?1:0)+(p===0?1:0);
          const mutual=a>=0 && b>=0;
          const score=state.score + coverage*100000 + 2000 + (mutual?120:0)
            + (a<0?0:10-a)+(b<0?0:10-b) + 2*(12-l-p);
          const dest=mask|bit;
          if(score<=(next.get(dest)?.score??-1)) continue;
          next.set(dest,{score,pairs:[...state.pairs,{round,room:room+1,lead:lead.id,partner:partner.id}]});
        }
      }
      states=next;
    }
    const best=[...states.values()].reduce((a,b)=>a.score>=b.score?a:b);
    if(!best.pairs.length)break;
    for(const m of best.pairs){
      meetings.push(m); seen.add(m.lead+"/"+m.partner);
      for(const id of [m.lead,m.partner])count.set(id,(count.get(id)||0)+1);
    }
  }
  return meetings;
}
