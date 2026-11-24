export const starterResources = [
  {id:"business-house",title:"Business House Copenhagen",type:"工具与指南",region:"哥本哈根",stage:"想法与早期",body:"哥本哈根市的创业支持入口，提供创业指导和本地转介。按市政府页面核对适用对象和预约方式。",source:"https://international.kk.dk/business/starting-your-business/business-house-copenhagen"},
  {id:"virk",title:"Start a company in Denmark",type:"工具与指南",region:"丹麦",stage:"设立经营主体",body:"丹麦企业登记的官方入口。先按实际经营形式核对登记要求。",source:"https://businessindenmark.virk.dk/authorities/stat/ERST/self-service/Start_company/"},
  {id:"innofounder",title:"Innofounder",type:"加速器",region:"丹麦",stage:"早期创新项目",body:"Innovation Fund Denmark 的创业支持项目。具体资格、项目周期和日期以当期征集为准。",source:"https://innovationsfonden.dk/en/p/innofounder/innofounder"},
  {id:"eic",title:"EIC Accelerator",type:"基金",region:"欧洲",stage:"成熟创新与规模化",body:"欧洲创新委员会官方项目入口。先核对公司所在地、技术成熟度、市场和资助条件。",source:"https://eic.ec.europa.eu/eic-funding-opportunities/eic-accelerator_en"},
  {id:"een",title:"Enterprise Europe Network",type:"工具与指南",region:"欧洲",stage:"国际合作与扩张",body:"欧洲企业网络的官方介绍，适合寻找国际合作和本地咨询入口。",source:"https://een.ec.europa.eu/about-enterprise-europe-network"},
].map(resource=>({...resource,checked:"2026-11-20",deadline:""}));

export const starterLessons = [
  {id:"problem",title:"把想法写成可验证的问题",phase:"第 1 天 · 问题定义",body:"选一个已有行为的用户群。记录他们上次遇到这个问题时做了什么、付出多少时间和成本。",exercise:"填写一句话：当［人群］在［场景］里做［任务］，他们因［障碍］付出［代价］。列出推翻这句话的一项观察。"},
  {id:"interviews",title:"完成一轮不诱导的访谈",phase:"第 2 天 · 访谈",body:"问最近一次真实经历、目前的替代方案和如何选择。先记录对方做过的事，再询问原因。",exercise:"写三条开放问题，记录一次原话、一个反例，以及它如何改变你的方案。"},
  {id:"prototype",title:"制作能被试用的最小原型",phase:"第 4 天 · 原型",body:"让用户完成一个具体任务。原型可以是一页服务说明、手工流程、交互界面或演示样机。",exercise:"明确一次测试只看一个行为。记录起点、任务、是否完成及阻碍。"},
  {id:"market",title:"测试一个渠道与一种表达",phase:"第 6 天 · 市场",body:"选择一个能接触真实用户的渠道，解释为谁解决什么问题。定义一个比浏览量更接近使用的行为。",exercise:"写出用户愿意做的一步，记录发送次数、有效反馈和下一次改动。"},
  {id:"demo",title:"结项与个人贡献记录",phase:"第 7 天 · 展示",body:"用问题、已试过什么、证据与下一步组织展示。每位成员核对自己的角色和实际贡献。",exercise:"写一个结项页，包含可公开范围、查看链接、贡献与需要的支持。"},
];
