import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Founder2K — Ideas deserve a first week.',description:'创业快闪、女性共创与跨学科项目支持。',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
