import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { UpdateChecker } from './UpdateChecker'
import { browserHost } from '../../lib/desktopHost/browserHost'
import { useSettingsStore } from '../../stores/settingsStore'
import { useUpdateStore } from '../../stores/updateStore'

describe('UpdateChecker', () => {
  beforeEach(() => {
    useSettingsStore.setState({ locale: 'en' })
    Reflect.deleteProperty(window, '__TAURI__')
    window.desktopHost = {
      ...browserHost,
      kind: 'electron',
      isDesktop: true,
      capabilities: {
        ...browserHost.capabilities,
        updates: true,
      },
    }

    useUpdateStore.setState({
      status: 'available',
      availableVersion: '0.1.5',
      releaseNotes: '# Claude Code Haha v0.1.5\n\n[Release notes](https://example.com/releases/v0.1.5)',
      progressPercent: 0,
      downloadedBytes: 0,
      totalBytes: null,
      error: null,
      checkedAt: null,
      shouldPrompt: true,
      initialize: vi.fn().mockResolvedValue(undefined),
      checkForUpdates: vi.fn().mockResolvedValue(null),
      installUpdate: vi.fn().mockResolvedValue(undefined),
      dismissPrompt: vi.fn(),
    })
  })

  it('renders nothing when not in a desktop runtime', () => {
    window.desktopHost = {
      ...browserHost,
      kind: 'browser',
      isDesktop: false,
      capabilities: browserHost.capabilities,
    }
    useUpdateStore.setState({ status: 'downloaded' })

    const { container } = render(<UpdateChecker />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing in Electron desktop runtime even when an update is downloaded', () => {
    useUpdateStore.setState({ status: 'downloaded' })

    const { container } = render(<UpdateChecker />)
    expect(container.innerHTML).toBe('')
    expect(screen.queryByText('Update ready')).not.toBeInTheDocument()
    expect(screen.queryByText('Install and restart')).not.toBeInTheDocument()
  })

  it('shows downloaded bytes when the updater does not provide total size', () => {
    useUpdateStore.setState({
      status: 'downloading',
      availableVersion: '0.1.5',
      releaseNotes: '# Claude Code Haha v0.1.5',
      progressPercent: 0,
      downloadedBytes: 1536,
      totalBytes: null,
      error: null,
      checkedAt: null,
      shouldPrompt: true,
      initialize: vi.fn().mockResolvedValue(undefined),
      checkForUpdates: vi.fn().mockResolvedValue(null),
      installUpdate: vi.fn().mockResolvedValue(undefined),
      dismissPrompt: vi.fn(),
    })

    render(<UpdateChecker />)

    expect(screen.queryByText('Downloading update... 1.5 KB downloaded')).not.toBeInTheDocument()
    expect(screen.queryByText('Update ready')).not.toBeInTheDocument()
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument()
  })

  it.each(['installing', 'restarting'] as const)('does not render UI during %s', (status) => {
    useUpdateStore.setState({
      status,
      availableVersion: '0.1.5',
      shouldPrompt: true,
    })

    const { container } = render(<UpdateChecker />)
    expect(container.innerHTML).toBe('')
    expect(screen.queryByText('Update ready')).not.toBeInTheDocument()
    expect(screen.queryByText('Install and restart')).not.toBeInTheDocument()
  })

  it('renders nothing when install fails after download', () => {
    useUpdateStore.setState({
      status: 'downloaded',
      error: 'installer failed',
      shouldPrompt: true,
    })

    const { container } = render(<UpdateChecker />)
    expect(container.innerHTML).toBe('')
    expect(screen.queryByText('Update ready')).not.toBeInTheDocument()
    expect(screen.queryByText('Update failed: installer failed')).not.toBeInTheDocument()
    expect(screen.queryByText('Install and restart')).not.toBeInTheDocument()
  })

  it('renders nothing throughout the Electron check/download/install flow', async () => {
    Reflect.deleteProperty(window, '__TAURI__')
    const download = vi.fn(async (onEvent?: (event: unknown) => void) => {
      onEvent?.({ event: 'Started', data: { contentLength: 100 } })
      onEvent?.({ event: 'Progress', data: { chunkLength: 100 } })
      onEvent?.({ event: 'Finished' })
    })
    const install = vi.fn().mockResolvedValue(undefined)
    const prepareInstall = vi.fn().mockResolvedValue(undefined)
    const relaunch = vi.fn().mockResolvedValue(undefined)
    window.desktopHost = {
      ...browserHost,
      kind: 'electron',
      isDesktop: true,
      capabilities: {
        ...browserHost.capabilities,
        updates: true,
      },
      updates: {
        ...browserHost.updates,
        check: vi.fn().mockResolvedValue({
          version: '0.2.0',
          body: 'Mock release feed',
          download,
          install,
          close: vi.fn().mockResolvedValue(undefined),
        }),
        prepareInstall,
        relaunch,
      },
    }

    vi.resetModules()
    const { UpdateChecker: FreshUpdateChecker } = await import('./UpdateChecker')
    const { useUpdateStore: freshUpdateStore } = await import('../../stores/updateStore')
    const { useSettingsStore: freshSettingsStore } = await import('../../stores/settingsStore')
    freshSettingsStore.setState({ locale: 'en' })
    freshUpdateStore.setState({
      status: 'idle',
      availableVersion: null,
      releaseNotes: null,
      progressPercent: 0,
      downloadedBytes: 0,
      totalBytes: null,
      error: null,
      checkedAt: null,
      shouldPrompt: false,
    })

    const { container } = render(<FreshUpdateChecker />)
    expect(container.innerHTML).toBe('')
    expect(screen.queryByText('Update ready')).not.toBeInTheDocument()
  })
})
