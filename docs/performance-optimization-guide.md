# 性能优化实施指南

本文档提供了如何继续实施性能优化的详细步骤和最佳实践。

## 🎯 优化目标

- ✅ 首屏加载时间 < 2 秒 (当前: ~3-4 秒)
- ✅ 主包体积 < 1MB (当前: 1.7MB)
- ✅ 最大组件文件 < 1000 行
- ✅ 测试覆盖率 > 80%

## 📋 已完成优化

### 1. Vite 构建配置优化 ✅

**文件**: `desktop/vite.config.ts`

**改进**:
- ✅ 添加了手动代码分割 (manualChunks)
- ✅ 分离了 React、UI、Markdown 等依赖
- ✅ 启用了 CSS 代码分割
- ✅ 优化了压缩配置

**验证**:
```bash
cd desktop
bun run build
# 检查 dist/assets 目录中的 chunk 大小
ls -lh dist/assets/
```

### 2. 懒加载工具创建 ✅

**文件**: `desktop/src/lib/lazyLoad.tsx`

**功能**:
- ✅ `createLazyComponent` 高阶函数
- ✅ 错误边界组件
- ✅ 加载占位符
- ✅ 预加载功能

**使用示例**:
```typescript
import { createLazyComponent } from '../lib/lazyLoad'

const LazySettings = createLazyComponent(
  () => import('./pages/Settings'),
  { loadingMessage: '加载设置页面...' }
)
```

### 3. Settings 工具函数提取 ✅

**文件**: `desktop/src/utils/settingsUtils.ts`

**提取内容**:
- ✅ H5 Access 工具函数 (9 个)
- ✅ Provider 工具函数 (25+ 个)
- ✅ Model 和 Context Window 工具函数

**效果**:
- 从 Settings.tsx 中提取了约 500 行工具函数
- 提升了代码可测试性
- 改善了代码组织

## 🔄 进行中优化

### 4. Settings.tsx 组件拆分

**当前状态**: 4209 行 → 目标 < 1000 行

**拆分策略**:

#### Step 1: 创建独立组件文件

每个主要设置标签页创建独立组件：

```
desktop/src/components/settings/
├── ProviderSettings.tsx    (已创建模板)
├── GeneralSettings.tsx
├── H5AccessSettings.tsx
├── AgentsSettings.tsx
├── SkillSettings.tsx
└── PluginSettings.tsx
```

#### Step 2: 更新主 Settings.tsx

```typescript
// 从独立的组件文件导入
import { ProviderSettings } from '../components/settings/ProviderSettings'
import { GeneralSettings } from '../components/settings/GeneralSettings'
// ... 其他导入

export function Settings() {
  // 主组件逻辑变得更简洁
  return (
    <div className="settings-page-root">
      <aside>{/* 侧边栏 */}</aside>
      <div className="settings-content-panel">
        {activeTab === 'providers' && <ProviderSettings />}
        {activeTab === 'general' && <GeneralSettings />}
        {/* ... */}
      </div>
    </div>
  )
}
```

#### Step 3: 测试和验证

```bash
# 运行类型检查
cd desktop && bun run lint

# 运行测试
bun run test

# 构建验证
bun run build
```

## 📝 实施模板

### 组件拆分模板

```typescript
/**
 * [功能名称] 设置组件
 * 从 Settings.tsx 拆分出来的独立组件
 */

import { useState, useEffect } from 'react'
import { useTranslation } from '../../i18n'
import { useSettingsStore } from '../../stores/settingsStore'
import { SettingsCard, SettingsRow } from '../../components/shared/SettingsCard'

export function FeatureSettings() {
  const t = useTranslation()
  const [localState, setLocalState] = useState()

  return (
    <div className="space-y-6">
      <SettingsCard>
        <SettingsRow
          title={t('settings.feature.title')}
          description={t('settings.feature.description')}
        >
          {/* 功能实现 */}
        </SettingsRow>
      </SettingsCard>
    </div>
  )
}

export default FeatureSettings
```

### 懒加载集成示例

```typescript
// desktop/src/App.tsx 或路由配置文件
import { LazyPages } from './lib/lazyLoad'

// 使用懒加载组件
<Route path="/settings" element={<LazyPages.Settings />} />
<Route path="/trace" element={<LazyPages.TraceSession />} />
```

## 🚀 下一步优化

### 5. 运行时性能优化

**优先级**: 高

**任务**:
- [ ] 添加 React.memo 到频繁渲染的组件
- [ ] 使用 useMemo/useCallback 优化计算
- [ ] 实现虚拟化长列表 (MessageList)
- [ ] 优化 Zustand store 选择器

**示例代码**:
```typescript
// 使用 React.memo 避免不必要渲染
const MessageItem = React.memo(({ message }: { message: Message }) => {
  return <div>{message.content}</div>
})

// 优化状态选择
const activeThread = useChatStore(s => s.threads[s.activeThreadId])
// 而不是
const { threads, activeThreadId } = useChatStore()
```

### 6. 依赖优化

**任务**:
- [ ] 移除未使用的 lodash (已有 lodash-es)
- [ ] 分析并优化大型依赖
- [ ] 配置 Tree Shaking

**命令**:
```bash
# 检查未使用的依赖
npx depcheck desktop

# 分析包体积
cd desktop && bun run build -- --mode analyze
```

### 7. 测试补充

**任务**:
- [ ] 为拆分后的组件补充单元测试
- [ ] 集成测试覆盖关键用户流程
- [ ] 提升测试覆盖率到 80%+

**测试模板**:
```typescript
import { render, screen } from '@testing-library/react'
import { FeatureSettings } from './FeatureSettings'

describe('FeatureSettings', () => {
  it('should render settings correctly', () => {
    render(<FeatureSettings />)
    expect(screen.getByText('设置')).toBeInTheDocument()
  })
})
```

## ⚠️ 注意事项

### 重构风险控制

1. **渐进式迁移**
   - 一次只拆分一个组件
   - 每次拆分后运行完整测试
   - 保持向后兼容

2. **测试验证**
   ```bash
   # 每次重构后必须运行
   bun run verify
   ```

3. **性能监控**
   - 使用 React DevTools 分析渲染性能
   - 监控包体积变化
   - 测量首屏加载时间

### 常见问题

**Q: 拆分后组件导入报错？**
A: 检查导入路径，确保使用了正确的相对路径。

**Q: 类型错误？**
A: 确保所有类型定义都已正确导入。

**Q: 性能没有提升？**
A: 检查是否正确使用了懒加载和代码分割。

## 📊 进度追踪

- [x] Vite 构建配置优化
- [x] 懒加载工具创建
- [x] Settings 工具函数提取
- [ ] Settings.tsx 组件拆分 (进行中)
- [ ] 运行时性能优化
- [ ] 依赖优化
- [ ] 测试补充

---

**更新日期**: 2026-06-28
**维护者**: Claude Code Haha Team
