import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../i18n', () => ({
  useTranslation: () => (key: string) => key,
}))

vi.mock('../stores/uiStore', () => {
  const useUIStore = (selector: (state: {
    pendingSettingsTab: 'activity'
  }) => unknown) => selector({ pendingSettingsTab: 'activity' })
  ;(useUIStore as any).getState = () => ({
    setPendingSettingsTab: vi.fn(),
    settingsEntrySessionId: null,
    setSidebarOpen: vi.fn(),
  })
  return { useUIStore }
})

vi.mock('../stores/tabStore', () => ({
  SETTINGS_TAB_ID: '__settings__',
  useTabStore: {
    getState: () => ({
      closeTab: vi.fn(),
      setActiveTab: vi.fn(),
    }),
  },
}))

vi.mock('../stores/chatStore', () => ({
  useChatStore: {
    getState: () => ({
      connectToSession: vi.fn(),
    }),
  },
}))

vi.mock('../lib/desktopRuntime', () => ({
  isDesktopRuntime: () => true,
}))

vi.mock('../lib/desktopHost', () => ({
  getDesktopHost: () => ({
    isDesktop: true,
  }),
}))

vi.mock('../stores/settingsStore', () => ({
  UI_ZOOM_DEFAULT: 1,
  UI_ZOOM_MIN: 0.8,
  UI_ZOOM_MAX: 1.2,
  UI_ZOOM_STEP: 0.1,
  useSettingsStore: () => ({}),
}))

vi.mock('../stores/providerStore', () => ({
  useProviderStore: () => ({}),
}))

vi.mock('../stores/agentStore', () => ({
  useAgentStore: () => ({}),
}))

vi.mock('../stores/sessionStore', () => ({
  useSessionStore: () => ({}),
}))

vi.mock('../stores/skillStore', () => ({
  useSkillStore: () => ({}),
}))

vi.mock('../stores/pluginStore', () => ({
  usePluginStore: () => ({}),
}))

vi.mock('../lib/desktopNotifications', () => ({
  getDesktopNotificationPermission: vi.fn(),
  notifyDesktop: vi.fn(),
  getDesktopNotificationPlatform: vi.fn(),
  openDesktopNotificationSettings: vi.fn(),
  requestDesktopNotificationPermission: vi.fn(),
}))

vi.mock('../lib/providerSettingsJson', () => ({
  API_KEY_JSON_PLACEHOLDER: '***',
  maskSettingsJsonSecrets: (value: string) => value,
  restoreSettingsJsonSecrets: (value: string) => value,
  stripProviderSettingsJsonEnv: (value: string) => value,
}))

vi.mock('../components/chat/clipboard', () => ({
  copyTextToClipboard: vi.fn(),
}))

vi.mock('../components/shared/Modal', () => ({ Modal: () => null }))
vi.mock('../components/shared/ConfirmDialog', () => ({ ConfirmDialog: () => null }))
vi.mock('../components/shared/Input', () => ({ Input: () => null }))
vi.mock('../components/shared/Button', () => ({ Button: () => null }))
vi.mock('../components/shared/Dropdown', () => ({ Dropdown: () => null }))
vi.mock('../components/markdown/MarkdownRenderer', () => ({ MarkdownRenderer: () => null }))
vi.mock('../components/skills/SkillList', () => ({ SkillList: () => null }))
vi.mock('../components/skills/SkillDetail', () => ({ SkillDetail: () => null }))
vi.mock('../components/plugins/PluginList', () => ({ PluginList: () => null }))
vi.mock('../components/plugins/PluginDetail', () => ({ PluginDetail: () => null }))
vi.mock('../components/settings/ClaudeOfficialLogin', () => ({ ClaudeOfficialLogin: () => null }))
vi.mock('../components/settings/ChatGPTOfficialLogin', () => ({ ChatGPTOfficialLogin: () => null }))

vi.mock('./AdapterSettings', () => ({ AdapterSettings: () => <div>adapters</div> }))
vi.mock('./ComputerUseSettings', () => ({ ComputerUseSettings: () => <div>computerUse</div> }))
vi.mock('./McpSettings', () => ({ McpSettings: () => <div>mcp</div> }))
vi.mock('./TerminalSettings', () => ({ TerminalSettings: () => <div>terminal</div> }))
vi.mock('./DiagnosticsSettings', () => ({ DiagnosticsSettings: () => <div>diagnostics</div> }))
vi.mock('./TraceList', () => ({ TraceList: () => <div>trace</div> }))
vi.mock('./ActivitySettings', () => ({ ActivitySettings: () => <div>activity</div> }))
vi.mock('./MemorySettings', () => ({ MemorySettings: () => <div>memory</div> }))

import { Settings } from './Settings'

describe('Settings layout', () => {
  it('uses the glass sidebar shell and chat-like content panel', () => {
    render(<Settings />)

    expect(screen.getByTestId('settings-sidebar-panel')).toHaveClass('settings-sidebar-panel')
    expect(screen.getByTestId('settings-content-panel')).toHaveClass('settings-content-panel')
    expect(screen.getByRole('button', { name: /settings\.backToApp/i })).toBeInTheDocument()
  })
})
