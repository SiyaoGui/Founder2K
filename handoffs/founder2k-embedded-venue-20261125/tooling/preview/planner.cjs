const {buildSync}=require('/workspace/sites-validation/node_modules/esbuild');
const fs=require('fs');
const root='/workspace/sites-validation';
const src=`import {useState} from 'react';import{createRoot}from 'react-dom/client';import TeamBoard from './app/venue/team-board';
const names=['林悦','周岚','Ada','Bo','Chen','Fay','Gil','Hao'];
const tags=['idea','idea','builder','builder','builder','seller','seller','open'];
const initial=names.map((name,i)=>({id:'demo-'+i,name,skills:'',tag:tags[i],group:'lobby'}));
function Demo(){
const [rows,update]=useState(initial),[rev,version]=useState(0),[reset,clear]=useState(0);
return <main className="venue-shell"><header><span>Founder2K</span><span>主持人调度台</span></header><h1>创业快闪 · 分组试排</h1><p>这里有 8 位示例成员。选「全选所有成员」再点「分发所选 8 人」，即可看见两个团队。发布仅更新本页。</p>
<TeamBoard key={reset} members={rows} rooms={[]} revision={rev} publish={async plan=>{const changed=new Map(plan.map(m=>[m.id,m]));update(rows.map(m=>changed.get(m.id)||m));version(rev+1)}}/>
<footer><output>{rev>0?'已发布到本页 · 第 '+rev+' 版':''}</output><button onClick={()=>{update(initial);version(0);clear(reset+1)}}>重置示例</button></footer></main>}
createRoot(document.getElementById('root')).render(<Demo/>);`;
const code=buildSync({stdin:{contents:src,loader:'tsx',resolveDir:root},bundle:true,write:false,minify:true,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}}).outputFiles[0].text;
const css=fs.readFileSync(root+'/app/venue/venue.css','utf8');
fs.writeFileSync('/workspace/shared/downloads/Founder2K-team-planner-demo.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Founder2K 快闪团队编组试排</title><style>body{margin:0;background:#faf9f5}*{box-sizing:border-box}h1{margin:16px 0}h3{font-size:1.4rem}button,select{font:inherit;cursor:pointer}footer{display:flex;gap:1rem;justify-content:space-between;align-items:center;padding:1rem 0}'+css+'</style><div id="root"></div><script>'+code.replace(/<\/script/gi,'<\\/script')+'</script></html>');
