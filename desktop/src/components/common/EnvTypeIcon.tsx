/**
 * EnvTypeIcon — environment type indicator for session headers.
 *
 * Ported from Codex's thread-env-icon component.
 * Shows a small icon indicating the session's execution environment:
 *   • local    — running locally (laptop icon)
 *   • worktree — running in a git worktree (git-branch icon + worktree badge)
 *   • cloud    — running in the cloud (cloud icon)
 *   • remote   — running on a remote host (globe icon)
 *
 * Each icon has a tooltip describing the environment.
 */
import { type ReactNode } from 'react'
import { Cloud, Globe, Laptop, GitBranch } from 'lucide-react'

export type EnvType = 'local' | 'worktree' | 'cloud' | 'remote'

export interface EnvTypeIconProps {
  type: EnvType
  className?: string
  disableTooltip?: boolean
}

const ENV_CONFIG: Record<EnvType, {
  icon: ReactNode
  tooltip: string
}> = {
  local: {
    icon: <Laptop size={14} strokeWidth={1.8} className="shrink-0" />,
    tooltip: '此对话运行在本地环境',
  },
  worktree: {
    icon: (
      <span className="inline-flex shrink-0 items-center gap-0.5">
        <Laptop size={14} strokeWidth={1.8} />
        <GitBranch size={10} strokeWidth={2} className="text-[var(--color-token-text-secondary)]" />
      </span>
    ),
    tooltip: '此对话运行在本地 Git worktree 中',
  },
  cloud: {
    icon: <Cloud size={14} strokeWidth={1.8} className="shrink-0 translate-x-px" />,
    tooltip: '此对话运行在云端',
  },
  remote: {
    icon: <Globe size={14} strokeWidth={1.8} className="shrink-0" />,
    tooltip: '此对话运行在远程主机上',
  },
}

export function EnvTypeIcon({ type, className, disableTooltip = false }: EnvTypeIconProps) {
  const config = ENV_CONFIG[type]

  if (disableTooltip) {
    return (
      <span className={`inline-flex shrink-0 items-center text-[var(--color-token-text-secondary)] ${className ?? ''}`}>
        {config.icon}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center text-[var(--color-token-text-secondary)] ${className ?? ''}`}
      title={config.tooltip}
    >
      {config.icon}
    </span>
  )
}
