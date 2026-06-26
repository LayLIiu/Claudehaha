import React, { useMemo } from 'react'
import ClaudeLogo from './ClaudeLogo'
import { useChatStore } from '../../stores/chatStore'
import { useTabStore } from '../../stores/tabStore'

const IDLE_LOGO_COLOR = '#D97757'

export interface ClaudeLogoWidgetProps {
  className?: string
  style?: React.CSSProperties
  /** 强制指定动画模式，不指定则自动根据聊天状态切换 */
  forceMode?: 'idle' | 'waiting' | 'thinking' | 'auto'
  /** 是否启用鼠标交互，auto 时默认 true */
  interactive?: boolean
}

/**
 * ClaudeLogoWidget — 戴安娜 Logo 包装组件
 *
 * 动画模式映射（auto 模式）：
 *  - idle     → 鼠标靠近触手跟随弯曲（默认/等待输入）
 *  - waiting  → 触手周期性呼吸收缩/展开（等待权限确认）
 *  - thinking → 触手螺旋旋转（Claude 正在思考）
 */
export const ClaudeLogoWidget: React.FC<ClaudeLogoWidgetProps> = ({
  className,
  style,
  forceMode = 'auto',
  interactive,
}) => {
  const activeTabId = useTabStore((s) => s.activeTabId)
  const sessionState = useChatStore((s) => activeTabId ? s.sessions[activeTabId] : undefined)

  const { mode, isInteractive } = useMemo(() => {
    if (forceMode !== 'auto') {
      return {
        mode: forceMode,
        isInteractive: interactive ?? (forceMode === 'idle'),
      }
    }

    const chatState = sessionState?.chatState
    const pendingPermission = sessionState?.pendingPermission

    // 权限等待时 → breathing 呼吸动画
    if (pendingPermission) {
      return { mode: 'waiting' as const, isInteractive: interactive ?? false }
    }

    // thinking / tool_executing / streaming → 螺旋旋转
    if (chatState === 'thinking' || chatState === 'tool_executing' || chatState === 'streaming') {
      return { mode: 'thinking' as const, isInteractive: interactive ?? false }
    }

    // idle → 鼠标交互
    return { mode: 'idle' as const, isInteractive: interactive ?? true }
  }, [forceMode, sessionState?.chatState, sessionState?.pendingPermission, interactive])

  return (
    <ClaudeLogo
      className={className}
      style={style}
      color={IDLE_LOGO_COLOR}
      autoAnimate={mode === 'thinking'}
      breathe={mode === 'waiting'}
      interactive={isInteractive}
    />
  )
}

export default ClaudeLogoWidget
