# Founder2K 工作交接 · 2026-11-24

接手开发先读 `collaboration/AGENTS.md`、`collaboration/docs/architecture.md` 和 `website/README.md`。本目录保存交接时的独立快照。仓库根目录的协作文档另有版本，修改前先比较。

## 产品方向

Founder2K 是母平台。女性共创沿用 HerStartupCamp 的设计、社区经验和品牌历史，帮助参与者找到互补伙伴，通过实际合作决定是否继续。创业快闪提供短周期验证场景，资源库维护基金、孵化器和比赛，三个入口共享项目及团队上下文。Nucleate Activator 提供教育、双向组队、导师答疑和展示的参考；外部机构资源须标明实际提供者。

## 接手顺序

1. 复盘先看 reports 内的《HerStartupCamp_旧项目复盘_2026-11-23.md》。证据索引在 research，会话覆盖表在 tables，聊天导出在 wechat。复盘中的证据编号与这些文件配套。关于小红书危机的传播数据应保留来源限定。
2. 开发从 website 开始，其中有前端、数据库迁移、接口和会场测试。女性共创原设计在 originals-herstartup 的 .fig 文件中。设计预览在 design-previews，早期源码及构建包在 site-snapshots。
3. 会场关注实名签到、全体演示切换至分组、主持权移交、轮次进度、排队及占位冲突。数据库测试与真人跨设备音视频验收分开记录。音视频服务、生产环境配置和当前发布版本须在运营帐号内核实。
4. 项目方已购域名。换帐号时另行验证域名注册商、DNS、Sites 与 GitHub 访问权限。登录会话和服务密钥通过各自服务重新授权。

## 还原归档

直接浏览网页设计可打开 `previews/`。原始 Figma 位于 `originals-herstartup` 分卷内，融资日历原始 HTML 位于 `references`。活动 slides、设计导入截图及协会登记照片位于 `reference-images`。后续维护可先检查 `website/tests`，再查看 `tooling` 中的项目专项脚本与 `site-snapshots` 内的历次交付。

现有文件中已保存 AI 克隆蓝图及营销邮件的抽取结果（research 内的 S279、S280，含文字、渲染页或内嵌截图）。两个输入原件在最初提供的桌面路径缺失。微信覆盖情况以复盘报告、覆盖表和实际导出批次为准。过往云端对话提及的会场设计补丁需要与本地交付区别核对，现有本地下载包括占位补丁和对应的源码 ZIP。

将同一类别全部 .7z 分卷下载到同一目录，用 7-Zip 打开 .7z.001 并输入项目所有者本机 handoff-recovery/RECOVERY-KEY.txt 内的口令。GitHub 转私密后仍使用同一口令。在每个归档内，files 保留资料和相对目录，MANIFEST.csv 包含原文件大小及 SHA-256。根目录 inventory.csv 提供分组数量，SHA256SUMS.txt 用于校验分卷。交接其它 AI 时请通过私密渠道另行交付口令。
