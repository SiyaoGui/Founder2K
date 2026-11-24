import type {Meeting} from "./women-matching";

export const roundMs=15*60_000, changeMs=2*60_000;
export const roundStart=(start:string,round:number)=>Date.parse(start)+10*60_000+(round-1)*(roundMs+changeMs);
export function liveRound(start:string,now:number) {
  for(let n=1;n<=6;n++) if(now>=roundStart(start,n)&&now<roundStart(start,n)+roundMs)return n;
  return 0;
}
export type VenueState={
  phase:"presentation"|"rooms"|"closed";
  slide:string;
  attendance:Record<string,string>;
  ready:Record<string,number>;
  finished:Record<string,boolean>;
};
export const initialVenue=():VenueState=>({phase:"presentation",slide:"欢迎参加匹配日。请确认姓名，并查看自己的房间表。",attendance:{},ready:{},finished:{}});
export const appointment=(m:Meeting)=>m.round+"-"+m.room;
type Input={state:VenueState; start:string; meetings:Meeting[]; member?:string; admin:boolean; now:number; action:string; text?:string; round?:number};
export function changeVenue({state,start,meetings,member,admin,now,action,text,round}:Input):VenueState {
  if(now<Date.parse(start)-30*60_000||now>=Date.parse(start)+120*60_000)throw Error("签到从开场前 30 分钟开放，会场在活动结束后关闭。");
  if(state.phase==="closed")throw Error("本场已结束。");
  if(["slide","presentation","rooms","close"].includes(action)){
    if(!admin)throw Error("只有总主持人可以执行此操作。");
    if(action==="slide"){
      if(!text?.trim()||text.trim().length>800)throw Error("请填写 1–800 字的讲稿。");
      return {...state,slide:text.trim()};
    }
    return {...state,phase:action==="close"?"closed":action as "rooms"|"presentation"};
  }
  if(!member)throw Error("请先报名本场活动。");
  if(action==="checkin"){
    if(!text?.trim()||text.trim().length>60)throw Error("请确认你的真实姓名。");
    return {...state,attendance:{...state.attendance,[member]:text.trim()}};
  }
  if(!state.attendance[member]||state.phase!=="rooms")throw Error("请先签到并等待主持人开放分组。");
  const current=liveRound(start,now);
  const meeting=meetings.find(m=>m.round===current&&(m.lead===member||m.partner===member));
  if(!meeting||round!==current||state.finished[appointment(meeting)])throw Error("这场会谈已结束或尚未轮到你。");
  if(action==="ready")return {...state,ready:{...state.ready,[member]:current}};
  if(action==="finish"&&member===meeting.lead&&state.ready[member]===current&&state.ready[meeting.partner]===current)
    return {...state,finished:{...state.finished,[appointment(meeting)]:true}};
  throw Error("双方到齐后由房间主持人结束本轮会谈。");
}
