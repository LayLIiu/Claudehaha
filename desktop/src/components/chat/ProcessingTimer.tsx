import { useState, useEffect, useRef } from 'react'

interface ProcessingTimerProps {
  startTime: number
  endTime: number | null
  isProcessing: boolean
}

export function ProcessingTimer({ startTime, endTime, isProcessing }: ProcessingTimerProps) {
  const [elapsed, setElapsed] = useState(() => {
    const end = endTime ?? Date.now()
    return Math.max(0, Math.floor((end - startTime) / 1000))
  })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isProcessing && !endTime) {
      setElapsed(Math.max(0, Math.floor((Date.now() - startTime) / 1000)))
      intervalRef.current = setInterval(() => {
        setElapsed(Math.max(0, Math.floor((Date.now() - startTime) / 1000)))
      }, 1000)
    } else if (endTime) {
      setElapsed(Math.max(0, Math.floor((endTime - startTime) / 1000)))
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [startTime, endTime, isProcessing])

  const formatTime = (totalSeconds: number) => {
    if (totalSeconds < 0) totalSeconds = 0
    if (totalSeconds < 60) return `${totalSeconds}秒`
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    if (h > 0) return `${h}小时${m.toString().padStart(2, '0')}分${s.toString().padStart(2, '0')}秒`
    return `${m}分${s.toString().padStart(2, '0')}秒`
  }

  return (
    <div className="flex items-center gap-2 px-1 py-2 text-[16px] text-[var(--color-text-tertiary)]">
      <span>{isProcessing && !endTime ? '处理中' : '已处理'}</span>
      <span className="font-mono tabular-nums">{formatTime(elapsed)}</span>
    </div>
  )
}
