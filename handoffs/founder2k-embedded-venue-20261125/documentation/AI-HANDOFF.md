# 下一位 AI 从哪里继续

## 当前产品和版本

成员从原活动页进入同源 `/venue?id=<活动 ID>`，沿用 Founder2K 登录身份和报名姓名。站内 `POST /api/venue` 提供签到、个人议程、媒体授权、交棒、通知、分组和调度。生产站点为 founder2k.com。Sites 项目为 `appgprj_6aff90e2aa188191b3577b40fae2533b`，D1 绑定为 `DB`。本窗口交付形态是站内 Web App 与内部 API。跨站 SDK、独立多租户 SaaS 服务尚未交付。

| 对照点 | 标识 | 用途 |
|---|---|---|
| 用户原始 Sites 源码 | 8205b6801de8017dbb9ed23033bddb8971822a52 | ZIP 注释记录此提交；使用 originals/uploads 的原件验证基线 |
| 本地 Git 导入快照 | 99b29af | 导入上述 ZIP 后的本地根提交，保留于 history/sites.bundle |
| 本窗口最终应用 | 9145d9f | application/ 对应该树；173 个源码文件 |
| 原始协作文档 | c213e96 | originals/collaboration-docs/ |
| 会场设计文档初稿 | 5a75b59 | 可通过 history/collaboration.bundle 查看 |
| 汇总后的协作文档 | 576bf35 | documentation/ 保存最终会场文档 |

## 决策、原因与入口

- **参与者从个人议程行动。** 读取已有女性共创双选排班，单独保存现场进度。实际起止、计划时间和愿意提前的明确同意各有自己的字段。固定六轮可预测，晚到、提前结束和掉线都不会改写整张时间表。[执行协议](venue-design.md)
- **媒体分配跟随服务端授权。** 总主持人把屏幕和声音送入独立演示房，交棒按组撤销。私聊使用唯一媒体房及双人占位；截止服务负责释放。对照入口为 application/app/api/venue、application/drizzle/0003_venue_execution.sql 和 application/scripts/venue-clock.mjs。开源 LiveKit 的实现需要主讲端按目标组发送，生产应实测上行能力和 TURN。[媒体与成本](venue-media.md)
- **主持人先看异常，再操作房间。** 求助、超时、接班人离线和信号状态优先显示。公告只传文字。恢复演示、召回及调度改动在确认前给出影响范围。[主持人操作单](venue-host.md)
- **快闪编组先形成草稿。** 有 idea 的成员分别带一队，Builder、Seller 可批量全选。组别由角色缺口和现有人数共同决定。随机和姓名排序改变分发顺序，未选的人维持原位。发布校验版本，避免两个操作覆盖同一安排。原组正在讨论时调人会触发该组重新连接。实现入口为 application/app/venue/grouping.ts 和 team-board.tsx。[快闪决策与界面](venue-design.md)
- **保护现有团队工作台。** 会场内分组用于本次活动；女性共创的长期组队仍要通过原邀请、接受和审核。合成账号已验证工作台交接。[实测结果](venue-validation.md)

## 复现、发布与未验证项

1. 在 application/ 运行 `npm ci`、`./node_modules/.bin/tsc --noEmit`、`npm run build`。使用 Node ≥22.13，浏览器彩排需要 Chromium 及 LiveKit Server。对数据库按原迁移顺序追加 0003。
2. 运行 `node --experimental-strip-types --test tests/venue-occupancy.test.mjs tests/venue-grouping.test.mjs`。完整本地彩排运行 `node tests/rehearsal/run.mjs`；20 组音频检查运行 `node tests/rehearsal/run.mjs --many-teams`。运行前按手册设置本地 LIVEKIT_SERVER 和 CHROMIUM。测试创建临时合成活动。历史辅助脚本含原机器的临时路径，日常复验使用 application/tests/rehearsal/。[彩排与部署依赖](venue-rehearsal.md)
3. 目标环境内核对 Sites 项目及线上当前源码，保留线上并行变更，使用官方短期凭据。配置私密媒体服务、签名 webhook、截止进程、DB 和既有身份验证。完成发布后用实际会员从原活动页复核，不把本地源码交付当作线上回执。
4. 生产验收仍需物理手机、摄麦、弱网/TURN、真实旁听者旧链接、真人导航、100 人连续四小时及 500 观众路演。当前记录覆盖 100 个合成成员的编排及 20 组、40 条同时 WebRTC 音频连接。新增收费服务或明显产生费用的压测先列金额和用途。[指标边界](venue-validation.md)

## 文件恢复

原始文件直接在 originals/。用 ZIP 原件解压后应用 patches/Founder2K-Sites-venue.patch，所得文件已逐项比对 application/。若需要本地提交链，从 history/sites.bundle 克隆并检出 window-final；协作文档类似。补丁、源码、HTML、PNG、CSV 和 Git 历史均在本目录内，接手者可以使用自己的 GitHub 和 Sites 身份。
