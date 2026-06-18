import { isDesktopRuntime } from '../../lib/desktopRuntime'

export function UpdateChecker() {
  if (!isDesktopRuntime()) return null
  return null
}
