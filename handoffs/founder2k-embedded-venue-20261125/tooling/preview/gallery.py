from pathlib import Path
from base64 import b64encode
from html import escape
p=Path('/workspace/shared/downloads/venue-preview')
views=[
('participant','参与者 · 桌面','开场演示播放时，右侧保留个人议程。'),
('mobile','参与者 · 手机','390 × 844 浏览器视口，底部保留当前安排、下一位和倒计时。'),
('mobile-agenda','手机 · 展开议程','点开底部议程后，可逐行查看六次会面的计划与现场状态。'),
('manager','分组管理员','本组交棒后，管理员可以看到在谈双方、下一位和补位入口。'),
('host','总主持人','这里截取调度台的异常摘要和房间列表。彩排中的一组正在私聊，另一组提交了补谈请求。'),
]
s=['''<!doctype html><html lang=zh-CN><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Founder2K 活动会场预览</title><style>
*{box-sizing:border-box}body{margin:0;background:#f6f5f0;color:#172f26;font:16px/1.55 system-ui,sans-serif}main{max-width:1280px;margin:auto;padding:24px clamp(12px,3vw,42px)}h1{margin:0;font-size:clamp(24px,4vw,36px)}header p{margin:4px 0 20px}nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}button{padding:9px 15px;background:white;color:#163e2b;border:1px solid #879c8f;border-radius:7px;font:inherit;cursor:pointer}button[aria-pressed=true]{color:white;background:#174831}figure{margin:0}figcaption{margin:0 0 10px}img{display:block;max-width:100%;height:auto;background:white;border:1px solid #c8d4cb;border-radius:8px}button:focus-visible{outline:3px solid #956001}</style><main><header><h1>Founder2K 活动会场预览</h1><p>本地彩排实屏截图 · 使用示例姓名与演示素材 · 手机画面来自 Chromium 手机尺寸视口</p></header><nav aria-label="选择角色视图">''']
for i,(slug,title,desc) in enumerate(views):s.append(f'<button type=button data-view="{slug}" aria-controls="{slug}" aria-pressed="{str(i==0).lower()}">{title}</button>')
s.append('</nav>')
for i,(slug,title,desc) in enumerate(views):
 img=b64encode((p/(slug+'.png')).read_bytes()).decode()
 s.append(f'<figure id="{slug}" {"" if not i else "hidden"}><figcaption>{escape(desc)}</figcaption><img alt="{escape(title)}会场截图" src="data:image/png;base64,{img}"></figure>')
s.append("""</main><script>for(const button of document.querySelectorAll('nav button'))button.addEventListener('click',()=>{for(const fig of document.querySelectorAll('figure')) fig.hidden=fig.id!==button.dataset.view;for(const b of document.querySelectorAll('nav button'))b.setAttribute('aria-pressed',String(b===button));});</script></html>""")
(p.parent/'Founder2K-venue-preview.html').write_text(''.join(s))
