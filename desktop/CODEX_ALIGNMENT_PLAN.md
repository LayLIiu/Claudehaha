# Codex 官方桌面应用前端对齐计划

> 基于 Codex Desktop v26.616.32156 反编译分析，对齐我们的前端架构与交互逻辑

---

## 一、架构对照总览

| 维度 | 我们（cc-haha） | 官方 Codex | 差距 |
|------|----------------|-----------|------|
| **框架** | React 18 + Zustand + Vite 8 + Tailwind v4 | React + Vite 8 + Tailwind v4.2.4 | ✅ 基本一致 |
| **Electron** | 42.3.0 | 42.1.0 | ✅ 一致 |
| **设计 Token** | 自定义 `--color-*` 体系 | VSCode 兼容 `--vscode-*` + `--color-token-*` 双层映射 | ⚠️ 需改造 |
| **状态管理** | 单一 chatStore（3311行） | 细粒度拆分：thread-context / composer-view-state / thread-panel-state | ⚠️ 需拆分 |
| **线程布局** | ActiveSession 单页面 | thread-layout + thread-scroll-layout + thread-virtualizer | ⚠️ 需重构 |
| **Composer** | ChatInput 单组件 | composer + composer-controller + composer-footer + composer-view-state | ⚠️ 需拆分 |
| **设置页** | Settings.tsx 4207行单体 | settings-page + settings-sections + settings-group + settings-row | ⚠️ 需拆分 |
| **IPC 桥接** | 直接 WebSocket | electronBridge preload 双向消息 + shared-object | ⚠️ 需增强 |
| **侧边栏** | 自定义 Sidebar（2064行） | sidebar-signals + sidebar-project-groups + sidebar-thread-row-signals | ⚠️ 需信号化 |
| **多窗口** | 不支持 | hotkey-window-new-thread-page + worktree 多窗口 | ❌ 缺失 |

---

## 二、设计 Token 系统对齐

### 2.1 官方 Codex 的 Token 架构

官方使用 **双层映射**：
```
--vscode-foreground (VSCode 标准 token)
  └─ --color-token-foreground (应用语义 token)
       └─ 实际组件使用 var(--color-token-foreground)
```

关键特性：
- `color-mix()` 实现透明度派生（如 `color-mix(in srgb, var(--vscode-foreground) 65%, transparent)`）
- Electron 窗口类型区分：`data-codex-window-type=electron|browser|chrome-extension`
- 主题变体：`.electron-dark` / `.electron-opaque`
- 圆角缩放：`--corner-radius-scale` + `superellipse(1.5)` 支持
- 安全区域：`--safe-area-left` / `--safe-area-right`

### 2.2 我们的改造方案

**Phase 1: 保留现有 `--color-*` 不变，新增 `--color-token-*` 语义层**

```css
:root {
  /* 现有变量保持不变 */
  --color-text-primary: ...;
  --color-surface: ...;

  /* 新增 VSCode 兼容的 token 层 */
  --color-token-foreground: var(--color-text-primary);
  --color-token-text-secondary: color-mix(in srgb, var(--color-text-primary) 65%, transparent);
  --color-token-description-foreground: color-mix(in srgb, var(--color-text-primary) 45%, transparent);
  --color-token-border: color-mix(in oklab, var(--color-text-primary) 8%, transparent);
  --color-token-border-heavy: color-mix(in oklab, var(--color-text-primary) 12%, transparent);
  --color-token-bg-primary: var(--color-surface);
  --color-token-bg-secondary: color-mix(in srgb, var(--color-surface) 92%, transparent);
  --color-token-main-surface-primary: var(--color-surface);
  --color-token-side-bar-background: var(--color-surface-sidebar);
  --color-token-editor-background: var(--color-surface);
  --color-token-input-background: var(--color-input-bg);
  --color-token-input-foreground: var(--color-text-primary);
  --color-token-input-border: var(--color-border);
  --color-token-focus-border: var(--color-brand);
  --color-token-charts-green: var(--color-success);
  --color-token-charts-red: var(--color-error);
  --color-token-charts-blue: var(--color-info);
  --color-token-charts-yellow: var(--color-warning);
  --color-token-charts-orange: var(--color-warning);
}
```

**Phase 2: 新增窗口类型标记**

```html
<!-- electron/main.ts 中 BrowserWindow 配置 -->
webPreferences: {
  preload: path.join(__dirname, 'preload.cjs'),
  additionalData: { windowType: 'electron' }
}
```

```css
[data-codex-window-type=electron] body {
  --cursor-interaction: default;
  overscroll-behavior: none;
  overflow: hidden;
}
```

**Phase 3: 圆角和间距系统统一**

```css
:root {
  --corner-radius-scale: 1;
  --radius-2xs-base: 0.125rem;
  --radius-xs-base: 0.25rem;
  --radius-sm-base: 0.375rem;
  --radius-md-base: 0.5rem;
  --radius-lg-base: 0.625rem;
  --radius-xl-base: 0.75rem;
  --radius-2xl-base: 1rem;
  --radius-3xl-base: 1.25rem;
  --radius-full: 9999px;

  /* 动态计算 */
  --radius-md: calc(var(--radius-md-base) * var(--corner-radius-scale));
}
```

---

## 三、线程（Thread）布局对齐

### 3.1 官方 Codex 的 Thread 架构

```
AppShell
  └─ app-shell-left-panel (sidebar)
  └─ main-surface (圆角容器)
       └─ thread-app-shell-chrome (顶部工具栏)
            ├─ thread-page-header
            ├─ git-branch-switcher
            └─ thread-overflow-menu
       └─ thread-scroll-layout (消息滚动区)
            ├─ thread-scroll-controller-context-value
            └─ thread-virtualizer (虚拟化消息列表)
       └─ thread-page-bottom-panel-state (底部面板)
            ├─ composer
            ├─ composer-controller
            └─ composer-footer
```

关键特性：
- `main-surface` 有 `border-radius: var(--radius-lg)` 和边框阴影，形成"浮动卡片"效果
- `thread-scroll-layout` 支持边缘滚动（edge scroll）模式
- `thread-virtualizer` 使用虚拟滚动（大消息列表性能优化）
- 消息区域有 `--thread-content-max-width: 48rem` 限制
- `--markdown-wide-block-max-width: 56rem` 代码块可更宽

### 3.2 我们的改造方案

**Phase 1: 创建 thread-layout 组件**

```
src/components/thread/
  ├─ ThreadLayout.tsx          # 主布局容器
  ├─ ThreadChrome.tsx          # 顶部工具栏（从 ActiveSession 提取）
  ├─ ThreadScrollLayout.tsx    # 消息滚动区
  ├─ ThreadPageHeader.tsx      # 页面标题+操作按钮
  └─ ThreadBottomPanel.tsx     # 底部面板（composer 容器）
```

**Phase 2: 添加 main-surface 容器**

```tsx
// ThreadLayout.tsx
<div className="main-surface">
  <ThreadChrome />
  <ThreadScrollLayout>
    <MessageList />
  </ThreadScrollLayout>
  <ThreadBottomPanel>
    <Composer />
  </ThreadBottomPanel>
</div>
```

对应 CSS：
```css
.main-surface {
  border-top-left-radius: var(--radius-lg);
  border-bottom-left-radius: var(--radius-lg);
  background-color: var(--color-token-main-surface-primary);
  box-shadow: var(--tw-shadow);
  --tw-ring-color: var(--color-token-border-heavy);
  overflow: hidden;
}
```

**Phase 3: 消息虚拟化**

目前 MessageList（3027行）是直接渲染，需要引入 `@tanstack/react-virtual` 或类似方案。

---

## 四、Composer 架构对齐

### 4.1 官方 Codex 的 Composer 架构

```
composer (主组件)
  ├─ composer-controller (状态控制逻辑)
  │    ├─ composer-view-state (视图状态：聚焦/展开/模式)
  │    └─ composer-utils (工具函数)
  ├─ composer-top-menu-chrome (顶部工具栏：模型选择/权限模式)
  ├─ 多行输入区 (multilineSurface)
  │    ├─ attachments 区域
  │    └─ ProseMirror 富文本编辑器
  ├─ composer-footer (底部操作栏)
  │    ├─ composer-footer-branch-switcher (分支切换)
  │    └─ 发送按钮 + 附件按钮
  └─ composer-suggestion-list (自动补全建议)
```

关键特性：
- 使用 ProseMirror 作为编辑器内核（支持 @mention、/command、附件嵌入）
- `multilineSurface` 圆角容器 `border-radius: var(--radius-3xl)`
- 附件区有内嵌圆角计算：`max(0px, calc(var(--composer-border-radius) - var(--composer-attachment-inset)))`
- footer 使用 container query 响应式：`@container composer-footer (width<=440px)`

### 4.2 我们的改造方案

**Phase 1: 拆分 ChatInput.tsx（1424行）为模块**

```
src/components/composer/
  ├─ Composer.tsx              # 主容器（multilineSurface）
  ├─ ComposerController.tsx    # 状态管理 hook
  ├─ ComposerTopChrome.tsx     # 顶部工具栏
  ├─ ComposerInput.tsx         # 文本输入区
  ├─ ComposerFooter.tsx        # 底部操作栏
  ├─ ComposerSuggestionList.tsx # 自动补全
  ├─ ComposerAttachments.tsx   # 附件区域
  └─ useComposerViewState.ts   # 视图状态 hook
```

**Phase 2: Composer 样式对齐**

```css
.composer-multiline-surface {
  --composer-border-radius: var(--radius-3xl);
  border-radius: var(--composer-border-radius);
  overflow-y: auto;
}

.composer-attachments {
  --composer-attachment-inset: calc(var(--spacing) * 2);
  --composer-attachment-border-radius: max(0px, calc(var(--composer-border-radius) - var(--composer-attachment-inset)));
  padding: var(--composer-attachment-inset);
  padding-bottom: calc(var(--spacing) * 1.5);
}
```

---

## 五、Settings 架构对齐

### 5.1 官方 Codex 的 Settings 架构

```
settings-page
  ├─ settings-content-layout (布局容器)
  ├─ settings-host-context (宿主环境上下文)
  ├─ settings-host-dropdown (宿主下拉)
  ├─ settings-sections (分组区块)
  │    ├─ settings-group (设置组)
  │    │    └─ settings-row (单行设置项)
  │    └─ settings-external-section (外部扩展设置)
  ├─ settings-empty-state (空状态)
  └─ settings.cog (入口图标)
```

### 5.2 我们的改造方案

**Phase 1: 拆分 Settings.tsx（4207行）**

已具备部分拆分（McpSettings, TerminalSettings, ComputerUseSettings, AdapterSettings 等已独立），
但 ProviderSettings、GeneralSettings、H5AccessSettings、AgentsSettings 仍在主文件中。

```
src/pages/settings/
  ├─ Settings.tsx              # 主框架（仅导航 + 路由）
  ├─ ProviderSettings.tsx      # 已独立
  ├─ GeneralSettings.tsx       # 需提取
  ├─ H5AccessSettings.tsx      # 需提取
  ├─ AgentsSettings.tsx        # 需提取
  ├─ SettingsShared.tsx        # 共享组件（SummaryCard, MetaPill 等）
  └─ SettingsLayout.tsx        # 布局组件
```

**Phase 2: 设置页面组件化**

将 `SettingsCard` + `SettingsRow` 对齐到官方的 `settings-group` + `settings-row` 模式：

```tsx
<SettingsGroup title={t('settings.general.appearance')}>
  <SettingsRow label={t('settings.general.theme')}>
    <ThemeToggle />
  </SettingsRow>
  <SettingsRow label={t('settings.general.language')}>
    <LanguageDropdown />
  </SettingsRow>
</SettingsGroup>
```

---

## 六、IPC 桥接对齐

### 6.1 官方 Codex 的 IPC 架构

```js
// preload.js 暴露的 electronBridge
{
  windowType: 'electron',
  sendMessageFromView(msg),       // 发消息到主进程
  getPathForFile(file),           // 安全文件路径
  sendWorkerMessageFromView(id, msg), // Worker 通信
  subscribeToWorkerMessages(id, cb),  // Worker 订阅
  showContextMenu(options),       // 原生右键菜单
  showApplicationMenu(id, x, y),  // 原生应用菜单
  getSharedObjectSnapshotValue(key), // 共享状态快照
  getSystemThemeVariant(),        // 系统主题
  subscribeToSystemThemeVariant(cb), // 主题变更订阅
  getSentryInitOptions(),         // 错误追踪配置
  getAppSessionId(),              // 应用会话ID
  getBuildFlavor(),               // 构建变体
  isIntelMacBuild(),              // Intel Mac 检测
  usesOwlAppShell(),              // OWL 外壳标记
}
```

消息格式：
```js
// 从渲染进程到主进程
{ type: 'start-conversation', ... }
{ type: 'send-follow-up-message', ... }
{ type: 'shared-object-set', key, value }

// 从主进程到渲染进程
{ type: 'shared-object-updated', key, value }
{ type: 'broadcast-conversation-snapshot', ... }
```

### 6.2 我们的改造方案

**Phase 1: 扩展 preload bridge**

在现有 preload.ts 基础上，新增：
```ts
// electron/preload.ts 新增
contextBridge.exposeInMainWorld('electronBridge', {
  windowType: 'electron',
  sendMessageFromView: (msg) => ipcRenderer.invoke('codex:message-from-view', msg),
  getSystemThemeVariant: () => nativeTheme.themeSource,
  subscribeToSystemThemeVariant: (cb) => {
    nativeTheme.on('updated', () => cb(nativeTheme.themeSource))
  },
  showContextMenu: (options) => ipcRenderer.invoke('codex:show-context-menu', options),
  getSharedObjectSnapshotValue: (key) => sharedObject[key],
  // ...
})
```

**Phase 2: 消息类型统一**

将 WebSocket 消息类型对齐到官方的命名风格：
```
旧: { type: 'chat_message', ... }
新: { type: 'send-follow-up-message', ... }

旧: { type: 'session_created', ... }
新: { type: 'start-conversation', ... }
```

---

## 七、侧边栏信号化

### 7.1 官方 Codex 的侧边栏架构

```
sidebar-signals           # 全局信号源
  ├─ sidebar-project-groups        # 项目分组
  ├─ sidebar-project-group-signals # 项目组信号
  ├─ sidebar-thread-keys          # 线程键值
  ├─ sidebar-thread-row-signals   # 线程行信号
  ├─ sidebar-project-hover-card-source-rows  # 悬浮卡片
  └─ sidebar-task-pr-chip-signals # PR 芯片信号
```

使用 Signal/Atom 模式（而非 Zustand store）实现细粒度响应式更新。

### 7.2 我们的改造方案

保持 Zustand，但将 Sidebar（2064行）的逻辑拆分到独立 store：

```
src/stores/
  ├─ sidebarProjectStore.ts     # 项目分组/排序/折叠
  ├─ sidebarSessionListStore.ts # 会话列表/刷新/批量
  └─ sidebarPreferencesStore.ts # 偏好/持久化

src/components/sidebar/
  ├─ Sidebar.tsx              # 主容器（精简后）
  ├─ SidebarProjectGroup.tsx  # 项目组
  ├─ SidebarSessionRow.tsx    # 会话行
  ├─ SidebarContextMenu.tsx   # 右键菜单
  └─ SidebarHeaderMenu.tsx    # 顶部菜单
```

---

## 八、优先级排序

### P0 - 核心体验（1-2周）
1. ✅ 设计 Token 双层映射（保留现有 + 新增 `--color-token-*`）
2. ✅ Thread Layout 拆分（从 ActiveSession 提取）
3. ✅ main-surface 浮动卡片样式
4. ✅ Composer 拆分（从 ChatInput 提取）

### P1 - 交互细节（2-4周）
5. ✅ Composer 圆角容器 + 附件内嵌圆角
6. ✅ 设置页拆分（ProviderSettings、GeneralSettings 独立文件）
7. ✅ 消息列表虚拟化
8. ✅ 窗口类型 data 属性 + 主题变体

### P2 - 高级功能（4-8周）
9. ⏳ IPC Bridge 对齐（electronBridge + shared-object）
10. ⏳ 侧边栏 Store 拆分
11. ⏳ 消息类型命名统一
12. ⏳ 容器查询响应式（container queries）

### P3 - 未来
13. 🔮 ProseMirror 富文本编辑器
14. 🔮 多窗口支持
15. 🔮 Worktree 集成
16. 🔮 superellipse 圆角

---

## 九、命名对照表

| 我们现在 | 官方 Codex | 改造方向 |
|---------|-----------|---------|
| `ActiveSession` | `thread-layout` | 重命名 + 拆分 |
| `ChatInput` | `composer` | 重命名 + 拆分 |
| `MessageList` | `thread-virtualizer` | 虚拟化 |
| `Sidebar` | `app-shell-left-panel` + signals | 拆分 |
| `Settings` | `settings-page` + sections | 拆分 |
| `--color-text-primary` | `--color-token-foreground` | 新增映射 |
| `--color-surface` | `--color-token-main-surface-primary` | 新增映射 |
| `--color-surface-hover` | `--color-token-list-hover-background` | 新增映射 |
| `--color-border` | `--color-token-border` | 新增映射 |
| `--color-brand` | `--color-token-text-link-foreground` | 新增映射 |

---

*文档版本: 2026-06-19*
*基于 Codex Desktop v26.616.32156 分析*
