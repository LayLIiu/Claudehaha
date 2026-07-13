/**
 * GitSideView — 右侧面板 Git 视图
 *
 * 参考 ZCode 的 GitSideView：展示当前 session 工作区的 changed files，
 * 点击文件可预览 diff。
 */
import { useEffect, useState } from 'react'
import { FileDiff } from 'lucide-react'
import { sessionsApi, type SessionGitInfo } from '../../api/sessions'
import { useTranslation } from '../../i18n'
import { useWorkspacePanelStore } from '../../stores/workspacePanelStore'

type GitSideViewProps = {
  sessionId: string
}

export function GitSideView({ sessionId }: GitSideViewProps) {
  const t = useTranslation()
  const [gitInfo, setGitInfo] = useState<SessionGitInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const setActiveView = useWorkspacePanelStore((s) => s.setActiveView)

  useEffect(() => {
    sessionsApi
      .getGitInfo(sessionId)
      .then((res: any) => setGitInfo(res.data || res))
      .catch((err) => setError(err instanceof Error ? err.message : 'Git info unavailable'))
  }, [sessionId])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-[13px] text-[var(--color-error)]">
        {error}
      </div>
    )
  }

  if (!gitInfo) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-[var(--color-token-text-secondary)]">
        {t('sidePane.loading')}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--color-token-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <FileDiff size={16} className="text-[var(--color-token-text-secondary)]" />
          <span className="text-[13px] font-semibold text-[var(--color-token-foreground)]">
            {gitInfo.repoName || t('sidePane.gitTitle')}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-[var(--color-token-text-secondary)]">
          {gitInfo.branch || '—'} · {gitInfo.changedFiles} {t('sidePane.changedFiles')}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <button
          type="button"
          onClick={() => sessionId && setActiveView(sessionId, 'changed')}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-token-border)] px-3 py-2 text-[13px] text-[var(--color-token-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
        >
          {t('sidePane.viewChangedFiles')}
        </button>
      </div>
    </div>
  )
}
