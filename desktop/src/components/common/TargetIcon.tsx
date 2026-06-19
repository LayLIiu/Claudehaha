import { useEffect, useState } from 'react'
import { Code2, FolderOpen } from 'lucide-react'
import type { OpenTarget } from '../../stores/openTargetStore'

function TerminalIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}

function XcodeIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.4 2.7a1 1 0 0 0-1.8 0L2.2 18.4a1 1 0 0 0 .9 1.4h2.8a1 1 0 0 0 .9-.6L12 7l5.2 12.2a1 1 0 0 0 .9.6h2.8a1 1 0 0 0 .9-1.4L14.4 2.7a1 1 0 0 0-1.8 0L12 5.5" />
      <path d="M7 13h10" />
    </svg>
  )
}

const BUILTIN_ICONS: Record<string, React.FC<{ size: number }>> = {
  terminal: TerminalIcon,
  xcode: XcodeIcon,
}

export function getFallbackIcon(kind: 'ide' | 'file_manager', size = 17) {
  if (kind === 'file_manager') {
    return <FolderOpen size={size} strokeWidth={1.9} />
  }
  return <Code2 size={size} strokeWidth={1.9} />
}

export function TargetIcon({ target, size = 18 }: { target: OpenTarget; size?: number }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [target.iconUrl])

  const BuiltIn = target.icon ? BUILTIN_ICONS[target.icon] : null
  if (BuiltIn) {
    return <BuiltIn size={size} />
  }

  if (target.iconUrl && !failed) {
    return (
      <img
        src={target.iconUrl}
        alt=""
        aria-hidden="true"
        draggable={false}
        onError={() => setFailed(true)}
        className="block shrink-0 object-contain"
        style={{ width: size, height: size }}
      />
    )
  }

  return getFallbackIcon(target.kind, Math.max(16, size - 1))
}
