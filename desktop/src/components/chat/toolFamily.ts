/**
 * Tool family classifier — mirrors ZCode's tool family system.
 * Classifies tool names into semantic families for rendering and icon selection.
 */

export type ToolFamily =
  | 'file-read'
  | 'file-write'
  | 'shell'
  | 'search'
  | 'explore'
  | 'skill'
  | 'mcp'
  | 'agent'
  | 'plan-guidance'
  | 'todo'
  | 'ask-user-question'
  | 'session-context'
  | 'switch-mode'
  | 'goal'
  | 'fallback'

/**
 * Classify a tool name into a semantic family using regex patterns.
 * Order matters: more specific patterns should come first.
 */
export function classifyToolFamily(toolName: string): ToolFamily {
  if (/^Agent$/i.test(toolName)) return 'agent'
  if (/^(?:Skill)$/i.test(toolName)) return 'skill'
  if (/^mcp__/i.test(toolName)) return 'mcp'
  if (/^(?:ExitPlanMode|EnterPlanMode)$/i.test(toolName)) return 'plan-guidance'
  if (/^(?:TodoRead|TodoWrite|TaskCreate|TaskUpdate|TaskList|TaskGet)$/i.test(toolName)) return 'todo'
  if (/^(?:AskUserQuestion)$/i.test(toolName)) return 'ask-user-question'
  if (/^(?:Read|View|Open|Cat|Head|Tail|ReadFile)(?:_|$)/i.test(toolName)) return 'file-read'
  if (/(?:^|_)(?:Edit|Patch|Replace|MultiEdit|Write|Create|Save|ApplyPatch)(?:_|$)/i.test(toolName)) return 'file-write'
  if (/^(?:Execute|Run|Exec|Bash|Shell|Command|Terminal)(?:_|$)/i.test(toolName)) return 'shell'
  if (/^(?:Search|Grep|Find|Fetch|WebSearch|WebFetch|Query|Lookup|Glob|List|Ls|Dir|Tree)(?:_|$)/i.test(toolName)) return 'search'
  if (/^(?:Explore|Inspect)(?:_|$)/i.test(toolName)) return 'explore'
  if (/^(?:SwitchMode|SetMode)$/i.test(toolName)) return 'switch-mode'
  if (/^(?:SetGoal|UpdateGoal|Goal)$/i.test(toolName)) return 'goal'
  if (/^(?:NotebookEdit)$/i.test(toolName)) return 'file-write'
  return 'fallback'
}

/**
 * Get a human-readable label for a tool family.
 * Returns [running, completed] pair.
 */
export function getFamilyActionLabel(
  family: ToolFamily,
): [string, string] {
  switch (family) {
    case 'file-read':
      return ['正在读取', '已读取']
    case 'file-write':
      return ['正在写入', '已写入']
    case 'shell':
      return ['正在运行', '已运行']
    case 'search':
      return ['正在搜索', '已搜索']
    case 'explore':
      return ['正在探索', '已探索']
    case 'skill':
      return ['正在执行', '已执行']
    case 'mcp':
      return ['正在调用', '已调用']
    case 'agent':
      return ['正在派发', '已派发']
    case 'plan-guidance':
      return ['正在规划', '已规划']
    case 'todo':
      return ['正在更新', '已更新']
    case 'ask-user-question':
      return ['正在询问', '已询问']
    case 'session-context':
      return ['正在处理', '已处理']
    case 'switch-mode':
      return ['正在切换', '已切换']
    case 'goal':
      return ['正在设定', '已设定']
    case 'fallback':
    default:
      return ['正在执行', '已执行']
  }
}

/**
 * Get the display name for a tool family (used in group summaries).
 */
export function getFamilyDisplayName(family: ToolFamily): string {
  switch (family) {
    case 'file-read': return '文件读取'
    case 'file-write': return '文件写入'
    case 'shell': return '命令执行'
    case 'search': return '搜索'
    case 'explore': return '探索'
    case 'skill': return '技能'
    case 'mcp': return 'MCP'
    case 'agent': return 'Agent'
    case 'plan-guidance': return '规划'
    case 'todo': return '任务'
    case 'ask-user-question': return '询问'
    case 'session-context': return '会话'
    case 'switch-mode': return '模式切换'
    case 'goal': return '目标'
    case 'fallback': return '工具'
  }
}
