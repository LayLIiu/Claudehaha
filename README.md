# Claude Code Haha

<p align="center">
  <strong>一款开源的 Claude Code 桌面端工作台</strong>
</p>

<p align="center">
  把 AI 编程助手的会话、代码编辑、权限审批、多模型切换、远程控制等功能<br>
  集成到一个跨平台桌面应用中，让 Claude Code 脱离终端也能高效使用。
</p>

<div align="center">

[![License](https://img.shields.io/github/license/LayLIiu/Claudehaha)](LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/LayLIiu/Claudehaha?include_prereleases)](https://github.com/LayLIiu/Claudehaha/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)]()

</div>

---

## 功能概览

| 功能 | 说明 |
|------|------|
| 多会话工作台 | 标签页管理、项目切换、终端入口、会话历史，一个窗口搞定所有对话 |
| 分支 / Worktree 启动 | 新建会话时选择仓库分支，支持隔离 Worktree 避免污染主分支 |
| 右侧代码改动面板 | 聊天时实时查看已更改文件、增删行数和工作区状态 |
| 代码 Diff 可视化 | 直接查看 AI 对文件的编辑、Diff 对比和执行过程 |
| 权限与确认流 | 危险命令、工具调用、AI 反问可在桌面端集中审批 |
| 多模型提供商 | 支持 Anthropic 兼容 API、OpenAI / DeepSeek / Ollama 等第三方模型 |
| Computer Use | 授权后 Agent 可截屏、点击、输入，控制桌面应用 |
| H5 远程访问 | 一次性令牌在手机或其他浏览器接入当前桌面端会话 |
| IM 接入 | 通过 Telegram / 飞书 / 微信 / 钉钉远程对话和审批权限 |
| 定时任务 | 创建计划任务，定时自动执行 |
| Token 用量统计 | 查看本机 Token 使用趋势 |

---

## 安装

### 下载桌面端

前往 [Releases](https://github.com/LayLIiu/Claudehaha/releases) 下载对应平台安装包：

- **macOS** — `.dmg` 文件，拖入 Applications 即可
- **Windows** — `.exe` 安装程序
- **Linux** — `.AppImage` 或 `.deb`

> 当前版本未签名，首次打开需要手动放行：
> - macOS：右键点击 → 打开 → 仍要打开；或在终端运行 `xattr -cr /Applications/Claude\ Code\ Haha.app`
> - Windows：点击"更多信息" → "仍要运行"

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/LayLIiu/Claudehaha.git
cd Claudehaha

# 安装依赖
bun install

# 启动桌面端开发模式
cd desktop && bun run dev

# 或启动 CLI
cp .env.example .env
./bin/claude-haha
```

---

## 项目结构

```
├── src/              # CLI 核心（终端 UI、工具链、服务端）
├── desktop/          # 桌面端（Electron + React + Vite）
│   ├── src/          #   渲染进程 UI 代码
│   ├── electron/     #   Electron 主进程
│   └── scripts/      #   构建脚本
├── adapters/         # IM 适配器（Telegram / 飞书 / 微信 / 钉钉 / WhatsApp）
├── mobile/           # iOS 客户端（开发中）
├── docs/             # 文档站点（VitePress）
└── scripts/          # 质量门禁与 CI 脚本
```

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | TypeScript |
| 桌面端 | Electron + React + Vite |
| 终端 UI | React + Ink |
| 包管理 & 运行时 | Bun |
| API | Anthropic SDK |
| 状态管理 | Zustand |
| 协议 | MCP, LSP |

---

## 配置

首次启动后，在桌面端 **设置** 中配置：

1. **模型提供商** — 选择 API 格式（Anthropic / OpenAI 兼容），填入 API Key
2. **默认模型** — 设置每次会话默认使用的模型
3. **Computer Use** — 按需开启桌面控制功能
4. **IM 接入** — 配置 Telegram / 飞书 / 微信 / 钉钉的机器人 Token

更多配置参考 [环境变量文档](docs/guide/env-vars.md) 和 [第三方模型接入](docs/guide/third-party-models.md)。

---

## 致谢

本项目基于 [NanmiCoder/cc-haha](https://github.com/NanmiCoder/cc-haha) 开发，感谢原作者的贡献。

同时感谢以下开源项目：

- [React](https://github.com/facebook/react)
- [Electron](https://github.com/electron/electron)
- [Bun](https://github.com/oven-sh/bun)
- [Ink](https://github.com/vadimdemedes/ink)

---

## License

本项目遵循原仓库的许可证协议，仅供学习和研究用途。所有原始源码版权归 [Anthropic](https://www.anthropic.com) 所有。
