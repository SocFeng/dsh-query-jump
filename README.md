# dsh-query-jump

<p align="center">
  <strong>DSH WebUI · 会话提问导航</strong><br/>
  <sub>长对话里找回那句「我之前问过什么」 (｡･∀･)ﾉﾞ</sub>
</p>

<p align="center">
  <img alt="version" src="https://img.shields.io/badge/version-0.2.0-4f46e5?style=flat-square" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" />
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D20-22c55e?style=flat-square" />
  <img alt="platform" src="https://img.shields.io/badge/DSH-WebUI-111827?style=flat-square" />
</p>

---

## 这是什么

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) WebUI 用的**提问定位插件**。

对话区右缘有一排淡淡的短横线；悬停展开提问列表，点一下就能平滑跳回对应气泡。  
只收集**真实用户提问**，不掺模型回复和工具噪音。

> 适合长会话里快速翻找历史问题 ✧(｡•̀ᴗ-)✧

**当前版本：`0.2.0`**

---

## 能做什么

| | 功能 | 说明 |
| :---: | --- | --- |
| ✦ | 提问列表 | 只显示你发过的 Query，带日期时间 |
| ✦ | 一键跳转 | 点击条目 → 平滑滚到聊天位置 |
| ✦ | 当前位置 | 阅读中的那条会浮起高亮 |
| ✦ | 短横线轨 | 平时低调贴在对话右缘，不抢视线 |
| ✦ | 自定义前缀 | 🤗 / ★ / 序号… 随你定 |
| ✦ | 设置页配置 | `设置 → 插件 → Query 定位` |
| ✦ | 数据持久 | 重启 / 更新插件，列表一般还在 |

---

## 怎么用

### ① 安装

```bash
# GitHub（推荐）
dsh plugin --profile web remove dsh-query-jump
dsh plugin --profile web add github:SocFeng/dsh-query-jump

# 或本地开发
cd dsh-query-jump
npm install && npm run build
dsh plugin --profile web add link:.
```

然后**重启** `dsh web`，浏览器**硬刷新**。

> peer 依赖那一串 `WARN` 可以忽略，不影响使用 (￣▽￣)

### ② 日常操作

1. 打开任意会话，右侧会出现淡色短横线轨  
2. **鼠标移上去** → 弹出提问列表  
3. **点击某条** → 对话滚到对应位置（列表仍在）  
4. **鼠标移出** → 列表自动收起  

### ③ 改开关 / 前缀

打开：**设置 → 插件 →「Query 定位」**

| 选项 | 作用 |
| --- | --- |
| 启用面板 | 总开关；关掉后右侧导航消失 |
| 自定义符号 / 序号 | 列表开头显示符号还是 `1 2 3…` |
| 符号内容 | 自定义前缀，最多 8 个字符（默认 🤗） |

也可写在 profile 配置里：

```yaml
- insert:
  - id: query-jump
    name: dsh-query-jump
    config:
      enable: true
      markerStyle: emoji   # 或 number
      markerSymbol: "🤗"
      maxQuery: 200
```

### ④ 卸载

```bash
dsh plugin --profile web remove dsh-query-jump
```

重启 `dsh web` 即可。

---

## 效果示意

```
┌──────────────────────────────────────────────┐
│  DSH 对话区                         ┊ ──     │
│                                     ┊ ──     │
│   ┌────────────────────┐            ┊ ██ ←当前│
│   │ 你的提问气泡        │ ◀──────────┊ ──     │
│   └────────────────────┘            ┊ ──     │
│                                     ┊        │
│                          悬停展开 →  │ 🤗 问A │
│                                     │ 🤗 问B │
│                                     │ 🤗 问C │
└──────────────────────────────────────────────┘
```

---

## 版本说明

| 版本 | 说明 |
| --- | --- |
| **0.2.0** | 通义风短横线 + 悬停列表；设置页配置启用/前缀；平滑跳转；当前位置浮起高亮 |
| 0.1.x | 初版能力打磨（安装、持久化、跳转、UI 迭代） |

仓库：[github.com/SocFeng/dsh-query-jump](https://github.com/SocFeng/dsh-query-jump)

---

## 开发

```bash
npm install
npm run build   # → lib/index.js · lib/client.js
npm test
```

```
dsh-query-jump/
├── src/          # Host + Client 源码
├── lib/          # 构建产物
├── test/
├── cordis.patch.yml
└── package.json
```

本地联调：`link:.` → 改代码 → `npm run build` → 硬刷新（集合变更需重启 `dsh web`）。

---

## 小提示

- 建议本机 `127.0.0.1` 打开 WebUI（RPC 为 loopback）  
- 很早的历史消息会先翻页再跳，稍等一下就好  
- 只收录真人提问；注入 / 工具消息不会进列表  
- 与 Trajectory、其它导航插件可同时使用  

---

## License

[MIT](./LICENSE)

<p align="center">
  <sub>Made for DeepSeek Harness · Everything is a plugin ♪(´▽｀)</sub>
</p>
