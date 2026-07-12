/**
 * CommandPalette — Cmd+K 命令面板
 *
 * 参考 ZCode 的 cmdk 风格，但用已安装的组件自建，不引入新依赖。
 * - Cmd/Ctrl+K 全局快捷键打开
 * - 模糊搜索命令（>/prefix 切换 scope: >/=commands, #/=conversations, @/=files）
 * - Section 分组：suggested / panels / configure / app
 * - 上下箭头选择，Enter 执行
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  MessageSquare,
  Folder,
  SquareTerminal,
  Globe,
  GitBranch,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Search,
} from 'lucide-react'
import { useTranslation } from '../../i18n'

type CommandScope = 'all' | 'commands' | 'conversations' | 'files'

type CommandItem = {
  id: string
  label: string
  icon: React.ReactNode
  section: 'suggested' | 'panels' | 'configure' | 'app'
  keywords: string[]
  shortcut?: string
  run: () => void
}

type CommandPaletteProps = {
  open: boolean
  onClose: () => void
  commands: CommandItem[]
}

function parseScope(raw: string): { query: string; scope: CommandScope } {
  if (raw.startsWith('>')) return { query: raw.slice(1), scope: 'commands' }
  if (raw.startsWith('#')) return { query: raw.slice(1), scope: 'conversations' }
  if (raw.startsWith('@')) return { query: raw.slice(1), scope: 'files' }
  return { query: raw, scope: 'all' }
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.trim().toLocaleLowerCase()
  if (!q) return true
  const target = text.toLocaleLowerCase()
  return q.split(/\s+/).filter(Boolean).every((part) => target.includes(part))
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const t = useTranslation()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const { scope, filtered } = useMemo(() => {
    const { query: q, scope: s } = parseScope(query)
    const filtered = commands.filter((cmd) => {
      // scope 'commands' shows all items; conversations/files sources not yet wired
      if (s === 'conversations' || s === 'files') return false
      return fuzzyMatch(q, `${cmd.label} ${cmd.keywords.join(' ')}`)
    })
    return { scope: s, filtered }
  }, [query, commands])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        filtered[activeIndex]?.run()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, filtered, activeIndex, onClose])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const sections: Array<{ id: CommandItem['section']; title: string }> = [
    { id: 'suggested', title: t('commandPalette.sectionSuggested') },
    { id: 'panels', title: t('commandPalette.sectionPanels') },
    { id: 'configure', title: t('commandPalette.sectionConfigure') },
    { id: 'app', title: t('commandPalette.sectionApp') },
  ]

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[var(--color-overlay-scrim)]" onClick={onClose} />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('commandPalette.title')}
        className="liquid-glass glass-panel relative w-[min(620px,calc(100vw-48px))] max-h-[60vh] overflow-hidden rounded-[var(--radius-3xl)] shadow-[var(--shadow-xl)]"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-[var(--color-token-border)]/60 px-4 py-3">
          <Search size={18} className="shrink-0 text-[var(--color-token-text-secondary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('commandPalette.placeholder')}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--color-token-foreground)] outline-none placeholder:text-[var(--color-token-text-secondary)]"
            autoFocus
            aria-label={t('commandPalette.searchInput')}
          />
        </div>

        {/* Scope tabs */}
        <div className="flex items-center gap-1 border-b border-[var(--color-token-border)]/60 px-4 py-2 text-[11px]">
          {([
            { id: 'all', label: t('commandPalette.scopeAll'), prefix: '' },
            { id: 'commands', label: t('commandPalette.scopeCommands'), prefix: '>' },
            { id: 'conversations', label: t('commandPalette.scopeConversations'), prefix: '#' },
            { id: 'files', label: t('commandPalette.scopeFiles'), prefix: '@' },
          ] as const).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setQuery(s.prefix)}
              className={[
                'rounded-[var(--radius-sm)] px-2 py-1 font-medium transition-colors',
                scope === s.id
                  ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)]'
                  : 'text-[var(--color-token-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)]',
              ].join(' ')}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="max-h-[40vh] overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px] text-[var(--color-token-text-secondary)]">
              {t('commandPalette.empty')}
            </div>
          ) : (
            sections.map((section) => {
              const items = filtered.filter((cmd) => cmd.section === section.id)
              if (items.length === 0) return null
              return (
                <div key={section.id} className="mb-1">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-token-text-secondary)]">
                    {section.title}
                  </div>
                  {items.map((cmd) => {
                    const globalIndex = filtered.indexOf(cmd)
                    return (
                      <button
                        key={cmd.id}
                        type="button"
                        onClick={() => { cmd.run(); onClose() }}
                        onMouseEnter={() => setActiveIndex(globalIndex)}
                        className={[
                          'flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left transition-colors',
                          globalIndex === activeIndex
                            ? 'bg-[var(--color-surface-hover)] text-[var(--color-token-foreground)]'
                            : 'text-[var(--color-token-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)]',
                        ].join(' ')}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-token-bg-subtle,rgba(255,255,255,0.06))]">
                          {cmd.icon}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px]">{cmd.label}</span>
                        {cmd.shortcut && (
                          <kbd className="shrink-0 rounded border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 font-mono text-[10px]">
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

const ICON_MAP: Record<string, React.ReactNode> = {
  message: <MessageSquare size={16} />,
  folder: <Folder size={16} />,
  terminal: <SquareTerminal size={16} />,
  browser: <Globe size={16} />,
  git: <GitBranch size={16} />,
  settings: <Settings size={16} />,
  sidebarClose: <PanelLeftClose size={16} />,
  sidebarOpen: <PanelLeftOpen size={16} />,
  themeLight: <Sun size={16} />,
  themeDark: <Moon size={16} />,
}

export { ICON_MAP }
