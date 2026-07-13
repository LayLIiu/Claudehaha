/**
 * ToolSliceNotice — 工具调用懒加载分页提示
 *
 * 参考 ZCode 的 kpt 组件：显示 "Showing X of Y tools" + "Load more" 按钮。
 * 无 IntersectionObserver，由用户点击触发加载下一批。
 */
import { Loader2 } from 'lucide-react'
import { useTranslation } from '../../i18n'

type ToolSliceNoticeProps = {
  shown: number
  total: number
  loading: boolean
  failed: boolean
  onLoadMore: () => void
}

export function ToolSliceNotice({ shown, total, loading, failed, onLoadMore }: ToolSliceNoticeProps) {
  const t = useTranslation()
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-token-border)]/70 bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-token-text-secondary)] sm:flex-row sm:items-center sm:justify-between">
      <span>{t('chat.toolSliceNotice', { shown: String(shown), total: String(total) })}</span>
      <button
        type="button"
        onClick={onLoadMore}
        disabled={loading}
        className="inline-flex h-7 items-center gap-1 self-start rounded-[var(--radius-sm)] border border-[var(--color-token-border)] px-2 text-[13px] text-[var(--color-token-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-50 sm:self-auto"
      >
        {loading && <Loader2 size={12} className="animate-spin" />}
        {loading
          ? t('chat.toolSliceLoading')
          : failed
            ? t('chat.toolSliceRetry')
            : t('chat.toolSliceLoadMore')}
      </button>
    </div>
  )
}

export const TOOLS_INITIAL_COUNT = 12
export const TOOLS_PAGE_SIZE = 12
