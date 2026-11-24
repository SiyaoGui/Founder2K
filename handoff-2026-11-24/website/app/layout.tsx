import type { Metadata } from 'next';
import {SkipToContent} from './reading-controls';
import './globals.css';
import './editorial.css';
export const metadata:Metadata={title:'Founder2K · 创业快闪与女性共创',openGraph:{title:'Founder2K · 创业快闪与女性共创',description:'查看活动场次、找到共创伙伴，查阅创业资源。',type:'website'},icons:{icon:'/favicon.svg'},description:'在 Founder2K 参加创业快闪、寻找共创伙伴，查阅基金、孵化器与比赛机会。',other:{'page-type':'service','site-kind':'other'},robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN" data-type="service"><body><SkipToContent/>{children}</body></html>}
