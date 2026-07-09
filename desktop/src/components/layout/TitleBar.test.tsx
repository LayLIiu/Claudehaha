import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = {
  activeView: 'code' as 'code' | 'terminal' | 'history',
  setActiveView: vi.fn(),
}

vi.mock('../../stores/uiStore', () => ({
  useUIStore: ((selector?: (state: {
    activeView: typeof mocks.activeView
    setActiveView: typeof mocks.setActiveView
  }) => unknown) => {
    const state = {
      activeView: mocks.activeView,
      setActiveView: mocks.setActiveView,
    }
    return typeof selector === 'function' ? selector(state) : state
  }),
}))

vi.mock('../../i18n', () => ({
  useTranslation: () => (key: string) => key,
}))

import { TitleBar } from './TitleBar'

describe('TitleBar', () => {
  beforeEach(() => {
    mocks.activeView = 'code'
    mocks.setActiveView.mockReset()
  })

  it('renders without crashing on non-Windows platforms', () => {
    render(<TitleBar />)

    expect(screen.getByText('titlebar.code')).toBeInTheDocument()
    expect(screen.getByText('titlebar.terminal')).toBeInTheDocument()
    expect(screen.getByText('titlebar.history')).toBeInTheDocument()
  })
})
