<div align="center">

# dsh-query-jump

**DSH WebUI 会话提问导航** · `v0.3.0`

长对话里，把「我之前问过什么」找回来  
`(｡･∀･)ﾉﾞ`

[![version](https://img.shields.io/badge/v0.3.0-indigo?style=for-the-badge&label=release)](https://github.com/SocFeng/dsh-query-jump)
[![license](https://img.shields.io/badge/MIT-blue?style=for-the-badge&label=license)](./LICENSE)
[![dsh](https://img.shields.io/badge/DeepSeek%20Harness-WebUI-111827?style=for-the-badge)](https://github.com/deepseek-ai/deepseek-harness)

</div>

<br/>

## 简介

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的轻量插件：

- 对话区**右缘**一条淡色短横线
- **悬停**展开提问列表，**点击**平滑跳回气泡
- 只收录**真实用户提问**，干净好翻

适合超长会话里快速定位历史问题 ✧

---

## 功能

| 功能 | 说明 |
| :--- | :--- |
| 提问列表 | 仅用户 Query，带日期 + 时间 |
| 一键跳转 | 点击 → 平滑滚动到对应消息 |
| 当前位置 | 正在阅读的条目会浮起高亮 |
| 低调轨道 | 平时几乎不抢视线，悬停才展开 |
| 自定义前缀 | 🤗 / ★ / 序号，自己定 |
| 设置页 | `设置 → 插件 → Query 定位` |
| 同步历史提问 | 从会话日志补全安装前未记录的 query |
| 删除会话 | 永久删除（会话头 / 侧栏菜单） |
| 缓存同步 | 删会话、删工作区、分叉时自动对齐 |
| 持久化 | 重启、更新后列表通常还在 |

---

## 安装

```bash
dsh plugin --profile web remove dsh-query-jump
dsh plugin --profile web add github:SocFeng/dsh-query-jump
```

装完后：

1. 重启 `dsh web`
2. 浏览器硬刷新（Ctrl + F5）

本地开发：

```bash
npm install && npm run build
dsh plugin --profile web add link:.
```

> 安装时若出现 peer 依赖 `WARN`，可直接忽略 `(￣▽￣)`

卸载：

```bash
dsh plugin --profile web remove dsh-query-jump
```

---

## 使用

| 步骤 | 操作 |
| :---: | :--- |
| 1 | 打开会话，看对话区**右侧**淡色短横线 |
| 2 | **鼠标移上** → 弹出提问列表 |
| 3 | **点击条目** → 跳到对应气泡（列表仍保留） |
| 4 | **鼠标移出** → 列表自动收起 |

```
对话区                              右缘
┌─────────────────────┐            ──
│                     │            ──
│   ┌───────────┐     │ ◀── 跳转   ██  ← 当前
│   │ 提问气泡   │     │            ──
│   └───────────┘     │
│                     │     悬停 → 🤗 问过 A
│                     │           🤗 问过 B
└─────────────────────┘           🤗 问过 C
```

---

## 配置

路径：**设置 → 插件 → Query 定位**

| 选项 | 说明 |
| :--- | :--- |
| 启用面板 | 总开关 |
| 同步历史提问 | 按提问时间线补全未记录的 query |
| 自定义符号 / 序号 | 列表前缀样式 |
| 符号内容 | 最多 8 个字符，默认 `🤗` |

也可以写进 profile：

```yaml
config:
  enable: true
  markerStyle: emoji    # 或 number
  markerSymbol: "🤗"
  maxQuery: 200
  syncHistoricalQueries: true
```

---

## 版本

**`0.3.0`** — 当前稳定版

- 同步历史提问（按时间线补全未记录 query）
- 永久删除会话（官方未暴露能力）
- 删会话 / 删工作区 / 分叉时缓存自动同步

**`0.2.0`**

- 通义风短横线 + 悬停列表
- 设置页配置启用与前缀
- 平滑跳转 · 当前位置浮起高亮
- 重启持久化

`0.1.x` 为早期迭代。

---

## 开发

```bash
npm install
npm run build
npm test
```

```
src/     Host + Client
lib/     构建产物
test/    单元测试
```

联调：`link:.` → 改代码 → `npm run build` → 硬刷新  
（插件集合变更时需重启 `dsh web`）

---

## 说明

- 建议本机 `127.0.0.1` 访问 WebUI
- 很早的历史会先翻页再跳，稍等即可
- 不收录注入消息 / 工具事件
- 可与 Trajectory 等插件并存

---

<div align="center">

[MIT](./LICENSE) · [GitHub](https://github.com/SocFeng/dsh-query-jump)

`♪(´▽｀)` Made for DeepSeek Harness

</div>
