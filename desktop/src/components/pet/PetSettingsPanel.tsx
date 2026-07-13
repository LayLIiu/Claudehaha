import { usePetStore } from '../../stores/petStore'
import { PET_STATES, type PetState } from '../../types/pet'

const STATE_LABELS: Record<PetState, string> = {
  idle: '待机',
  'running-right': '向右移动',
  'running-left': '向左移动',
  waving: '挥手',
  jumping: '跳跃',
  failed: '失败',
  waiting: '等待输入',
  running: '处理中',
  review: '审查完成',
}

const POSITION_OPTIONS = [
  { value: 'bottom-right' as const, label: '右下角' },
  { value: 'bottom-left' as const, label: '左下角' },
  { value: 'bottom-center' as const, label: '底部居中' },
]

/**
 * Small settings panel for the pet feature.
 * Embedded in the session header or accessible via pet right-click.
 */
export function PetSettingsPanel() {
  const enabled = usePetStore((s) => s.enabled)
  const scale = usePetStore((s) => s.scale)
  const position = usePetStore((s) => s.position)
  const showLookDirection = usePetStore((s) => s.showLookDirection)
  const activePetId = usePetStore((s) => s.activePetId)
  const loadedPets = usePetStore((s) => s.loadedPets)
  const setEnabled = usePetStore((s) => s.setEnabled)
  const setScale = usePetStore((s) => s.setScale)
  const setPosition = usePetStore((s) => s.setPosition)
  const setShowLookDirection = usePetStore((s) => s.setShowLookDirection)
  const setActivePet = usePetStore((s) => s.setActivePet)
  const setPetState = usePetStore((s) => s.setPetState)

  const petList = Array.from(loadedPets.values())

  return (
    <div className="flex flex-col gap-3 p-3 text-sm text-[var(--color-token-foreground)]">
      {/* Enable toggle */}
      <label className="flex items-center justify-between gap-3">
        <span>宠物伙伴</span>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`relative h-5 w-9 rounded-full transition-colors ${
            enabled ? 'bg-[var(--color-success)]' : 'bg-[var(--color-token-border)]'
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </label>

      {enabled && (
        <>
          {/* Pet selector */}
          {petList.length > 1 && (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[var(--color-token-text-secondary)]">选择宠物</span>
              <div className="flex flex-wrap gap-1">
                {petList.map((pet) => (
                  <button
                    key={pet.id}
                    onClick={() => setActivePet(pet.id)}
                    className={`rounded-md px-2 py-1 text-xs transition-colors ${
                      activePetId === pet.id
                        ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
                        : 'bg-[var(--color-surface-hover)] text-[var(--color-token-text-secondary)] hover:text-[var(--color-token-foreground)]'
                    }`}
                  >
                    {pet.displayName}
                  </button>
                ))}
              </div>
            </label>
          )}

          {/* Scale */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-[var(--color-token-text-secondary)]">
              大小: {Math.round(scale * 100)}%
            </span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-[var(--color-token-border)] accent-[var(--color-success)]"
            />
          </label>

          {/* Position */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-[var(--color-token-text-secondary)]">位置</span>
            <div className="flex gap-1">
              {POSITION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPosition(opt.value)}
                  className={`rounded-md px-2 py-1 text-xs transition-colors ${
                    position === opt.value
                      ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
                      : 'bg-[var(--color-surface-hover)] text-[var(--color-token-text-secondary)] hover:text-[var(--color-token-foreground)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </label>

          {/* Look direction toggle */}
          <label className="flex items-center justify-between gap-3">
            <span className="text-xs">鼠标跟随注视</span>
            <button
              onClick={() => setShowLookDirection(!showLookDirection)}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                showLookDirection ? 'bg-[var(--color-success)]' : 'bg-[var(--color-token-border)]'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  showLookDirection ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>

          {/* Preview: state selector */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-[var(--color-token-text-secondary)]">预览动画状态</span>
            <div className="flex flex-wrap gap-1">
              {PET_STATES.map((state) => (
                <button
                  key={state}
                  onClick={() => setPetState(state)}
                  className="rounded-md bg-[var(--color-surface-hover)] px-1.5 py-0.5 text-[10px] text-[var(--color-token-text-secondary)] hover:text-[var(--color-token-foreground)] hover:bg-[var(--color-surface)] transition-colors"
                >
                  {STATE_LABELS[state]}
                </button>
              ))}
            </div>
          </label>
        </>
      )}
    </div>
  )
}
