import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'
import { CurrentTurnLiveChangePill } from './CurrentTurnLiveChangePill'

describe('CurrentTurnLiveChangePill', () => {
  it('renders current turn change totals and opens changes when clicked', () => {
    const onOpenChanges = vi.fn()
    render(
      <CurrentTurnLiveChangePill
        summary={{ fileCount: 2, additions: 13, deletions: 45 }}
        onOpenChanges={onOpenChanges}
      />,
    )

    const pill = screen.getByTestId('current-turn-live-change-pill')
    expect(pill).toHaveTextContent('2 个文件已更改')
    expect(screen.getByLabelText('13')).toBeInTheDocument()
    expect(screen.getByLabelText('45')).toBeInTheDocument()

    fireEvent.click(pill)
    expect(onOpenChanges).toHaveBeenCalledTimes(1)
  })

  it('does not render when there are no changes', () => {
    render(<CurrentTurnLiveChangePill summary={null} />)
    expect(screen.queryByTestId('current-turn-live-change-pill')).not.toBeInTheDocument()
  })
})
