# Founder2K 内嵌活动会场 · AI 接手入口

本目录交接 Founder2K 活动会场及快闪角色分组工作。继续开发使用 [application/](application/)，核对需求先读[产品决策与交付状态](documentation/AI-HANDOFF.md)。截至 2026-11-25，工作经过本地验证；生产私密站仍待发布。

| 要找什么 | 位置 |
|---|---|
| 用户提供的 Sites ZIP、原样解压的 146 个文件、当时的私密协作文档 | [originals/](originals/) |
| 集成后的完整站点、API、数据库迁移、测试 | [application/](application/) |
| 界面草图、权限、产品策略、选型、主持人操作单、验收报告 | [documentation/](documentation/) |
| 可拖动分组的独立 HTML、六视图截图画册 | [previews/html/](previews/html/) |
| 参与者、手机、分组管理员、主持人和快闪编组的 PNG | [previews/png/](previews/png/) |
| 文档原表导出的 CSV、验收指标 | [tables/](tables/) |
| 原始设计补丁、占位原型、基线至最终站点的集成补丁、协作文档补丁 | [patches/](patches/) |
| 分阶段交付 ZIP、整合交付包 | [releases/](releases/) |
| 最终构建和占位版构建的 dist 文件 | [builds/](builds/) |
| 开发提交历史、最早的占位原型 | [history/](history/) |
| 历史彩排记录、成功与失败的安装/测试日志、合成 SQL 与名单 | [evidence/](evidence/) |
| 媒体官方协议和价格依据、验证工具的版本信息 | [research/](research/) |
| 当时用于截图、生成预览、归档的脚本及已校验的 Linux 媒体服务发行包 | [tooling/](tooling/) |

离线体验请下载并用浏览器打开 [分组试排](previews/html/Founder2K-team-planner-demo.html)。它复用实际分组组件，写入当前示例页。会场各角色的运行实屏见[截图预览](previews/html/Founder2K-venue-preview.html)。GitHub 的文件浏览器默认展示 HTML 源码。

[文件清单](inventory.csv)列出各文件的路径、类别、字节数、SHA-256；[校验和](SHA256SUMS.txt)同时覆盖清单。两者不自列。独立目录与仓库已有的 `handoff-2026-11-24/` 可并存。

工作底稿包括成功、失败与后来修正的实验。判断能力边界时，以最终[实测报告](documentation/venue-validation.md)、[独立复验日志](evidence/logs/venue-team-sequential.log)和[20 组音频日志](evidence/logs/venue-many-final.log)为准。源码、原始附件及正式交付物保留原内容。运行日志中的凭据已脱敏。运行时密钥、账号会话、第三方依赖安装目录、浏览器缓存和本机数据库副本由目标环境自行提供；合成测试输入及重建脚本已收入本目录。
