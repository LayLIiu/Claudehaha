import { ModelSelector } from '../controls/ModelSelector'
import { DirectoryPicker } from '../shared/DirectoryPicker'
import { useTranslation } from '../../i18n'

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string

  modelId: string
  onModelChange: (modelId: string) => void
  providerId?: string | null
  onProviderIdChange: (providerId: string | null) => void

  folderPath: string
  onFolderPathChange: (path: string) => void

  useWorktree: boolean
  onUseWorktreeChange: (checked: boolean) => void
}

export function PromptEditor({
  value,
  onChange,
  placeholder,
  modelId,
  onModelChange,
  providerId,
  onProviderIdChange,
  folderPath,
  onFolderPathChange,
  useWorktree: _useWorktree,
  onUseWorktreeChange: _onUseWorktreeChange,
}: Props) {
  const t = useTranslation()
  return (
    <div className="glass-panel rounded-[var(--radius-xl)] focus-within:border-[rgba(255,255,255,0.16)] transition-colors overflow-visible">
      {/* Prompt textarea */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-y bg-transparent px-3 py-2.5 text-sm leading-relaxed text-[var(--color-token-foreground)] outline-none placeholder:text-[var(--color-token-text-secondary)]"
        style={{ minHeight: 120 }}
      />

      {/* Bottom toolbar */}
      <div className="border-t border-[var(--color-surface-glass-border)] px-3 py-2 flex flex-col gap-2 rounded-b-[14px]">
        {/* Row 1: Permission + Model selectors */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-error)]/8 px-2.5 py-1.5 text-xs font-medium text-[var(--color-error)]">
            <span className="material-symbols-outlined icon-xs">gavel</span>
            {t('newTask.fullPermissions')}
          </div>
          <ModelSelector
            runtimeSelection={modelId ? { providerId: providerId ?? null, modelId } : undefined}
            onRuntimeSelectionChange={(selection) => {
              onProviderIdChange(selection.providerId)
              onModelChange(selection.modelId)
            }}
          />
        </div>

        {/* Row 2: Folder picker */}
        <div className="flex items-center justify-between">
          <DirectoryPicker value={folderPath} onChange={onFolderPathChange} />
        </div>

        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-[var(--color-error)]/8 text-[10px] text-[var(--color-error)]">
          <span className="material-symbols-outlined icon-2xs">warning</span>
          {t('promptEditor.bypassWarning')}{folderPath ? ` ${t('promptEditor.within')} ${folderPath}` : ` ${t('promptEditor.selectFolder')}`}.
        </div>
      </div>
    </div>
  )
}
