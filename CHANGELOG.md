# Changelog

本文件记录所有版本的变更。安装始终指向仓库最新代码：

```bash
dsh plugin --profile web add github:SocFeng/dsh-query-jump
```

GitHub **Releases** 仅维护[最新稳定版](https://github.com/SocFeng/dsh-query-jump/releases/latest)的说明；历史版本见下文。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [0.3.1] - 2026-08-18

### 修复

- 超长上下文需「加载更早」历史时，点击 query 无法跳转或长时间卡住
- 跳转过程增加超时与停滞检测，避免无限等待

### 新增

- 设置项 **显示删除会话**（`showDeleteSession`，默认开启）：可隐藏标题栏垃圾桶与侧栏删除入口

---

## [0.3.0] - 2026-08-18

### 新增

- **同步历史提问**（`syncHistoricalQueries`，默认开启）：从会话日志按时间线补全安装前未记录的 query
- **永久删除会话**：标题栏垃圾桶 + 侧栏菜单，带确认弹窗
- **缓存生命周期同步**：
  - 删除会话、切换工作区时自动清理 query 缓存
  - 分叉会话时从 seed 复制 query 索引
- 磁盘持久化：`~/.dsh/storages/query-jump/*.json`

---

## [0.2.0] - 2026-08-18

### 新增

- **自定义前缀符号**：emoji 或序号，符号内容最多 8 字符（默认 🤗）
- 配置迁移到 **设置 → 插件 → Query 定位**

### 改进

- 通义风短横线 + 悬停列表，平时几乎不抢视线
- 平滑跳转：滚动动画结束后再锁定目标，避免 assistant 流式输出时跳动
- 当前位置浮起高亮；点击跳转后列表保持展开，移出才收起
- 提问索引持久化，重启、更新后列表通常还在

---

## [0.1.3] - 2026-08-18

首个可用版本。

### 新增

- 对话区右缘 **tick rail**（淡色短横线），悬停展开提问列表
- 仅收录真实用户提问，带日期 + 时间
- 点击条目跳转到对应气泡
- 当前位置高亮
- 面板底部配置：启用开关、emoji / 序号前缀样式
- 设置项通过 Schemastery schema 注册，支持 profile 配置

### 改进（0.1.x 迭代）

- 移除弹窗 chrome，保留 tick rail 悬停列表
- 跳转时 quieter 动画、更窄列表、emoji 前缀
- 流式输出期间保持滚动目标稳定

---

[0.3.1]: https://github.com/SocFeng/dsh-query-jump/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/SocFeng/dsh-query-jump/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/SocFeng/dsh-query-jump/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/SocFeng/dsh-query-jump/releases/tag/v0.1.3
