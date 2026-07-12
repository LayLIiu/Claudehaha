import { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../../i18n'
import { useChatStore } from '../../stores/chatStore'
import { SETTINGS_TAB_ID, useTabStore } from '../../stores/tabStore'
import { useUIStore } from '../../stores/uiStore'
import { useSessionStore } from '../../stores/sessionStore'
import { useSessionRuntimeStore } from '../../stores/sessionRuntimeStore'
import { useTeamStore } from '../../stores/teamStore'
import { useSettingsStore } from '../../stores/settingsStore'
import {
  formatWorkspaceReferencePrompt,
  useWorkspaceChatContextStore,
  type WorkspaceChatReference,
} from '../../stores/workspaceChatContextStore'
import { sessionsApi, type SessionGitInfo } from '../../api/sessions'
import { agentsApi } from '../../api/agents'
import { PermissionModeSelector } from '../controls/PermissionModeSelector'
import { ModelSelector } from '../controls/ModelSelector'
import type { AttachmentRef } from '../../types/chat'
import { AttachmentGallery } from './AttachmentGallery'
import { ComposerDropOverlay } from './ComposerDropOverlay'
import { RepositoryLaunchControls } from '../shared/RepositoryLaunchControls'
import { FileSearchMenu, type FileSearchMenuHandle } from './FileSearchMenu'
import { LocalSlashCommandPanel, type LocalSlashCommandName } from './LocalSlashCommandPanel'
import { ContextUsageIndicator } from './ContextUsageIndicator'
import { QueuedPrompts } from './QueuedPrompts'
import {
  appendAgentSlashCommands,
  buildAgentSlashCommands,
  getLocalizedFallbackCommands,
  filterSlashCommands,
  findSlashTrigger,
  mergeSlashCommands,
  replaceSlashToken,
  resolveSlashUiAction,
} from './composerUtils'
import { useMobileViewport } from '../../hooks/useMobileViewport'
import { isDesktopRuntime } from '../../lib/desktopRuntime'
import {
  filesToComposerAttachments,
  selectNativeFileAttachments,
  type ComposerAttachment,
} from '../../lib/composerAttachments'
import { useComposerFileDrop } from './useComposerFileDrop'
import { shouldSubmitOnEnter } from './sendShortcut'
import { ClawdPersona } from './ClawdPersona'

type GitInfo = SessionGitInfo

type Attachment = ComposerAttachment

type HeroRecentItem = {
  id: string
  title: string
  projectLabel: string
  meta?: string
}

type ChatInputProps = {
  variant?: 'default' | 'hero'
  compact?: boolean
  onSubmitStart?: () => void
  heroTitle?: string
  heroRecentItems?: HeroRecentItem[]
  onOpenHeroRecentItem?: (sessionId: string) => void
}

const EMPTY_WORKSPACE_REFERENCES: WorkspaceChatReference[] = []

function workspaceReferenceToAttachment(reference: WorkspaceChatReference): Attachment {
  return {
    id: reference.id,
    name: reference.name,
    type: 'file',
    path: reference.kind === 'chat-selection' ? undefined : reference.path,
    isDirectory: reference.isDirectory,
    lineStart: reference.lineStart,
    lineEnd: reference.lineEnd,
    note: reference.note,
    quote: reference.quote,
  }
}

function insertComposerTokenAtRange(value: string, start: number, end: number, token: string) {
  const boundedStart = Math.max(0, Math.min(start, value.length))
  const boundedEnd = Math.max(boundedStart, Math.min(end, value.length))
  const before = value.slice(0, boundedStart)
  const after = value.slice(boundedEnd)
  const leadingSpace = before.length > 0 && !/\s$/.test(before) ? ' ' : ''
  const trailingSpace = after.length > 0 && !/^\s/.test(after) ? ' ' : ''
  const insertion = `${leadingSpace}${token}${trailingSpace}`

  return {
    value: `${before}${insertion}${after}`,
    cursorPos: before.length + insertion.length,
  }
}

export function ChatInput({
  variant = 'default',
  compact = false,
  onSubmitStart,
  heroTitle,
  heroRecentItems = [],
  onOpenHeroRecentItem,
}: ChatInputProps) {
  const t = useTranslation()
  const isMobileComposer = useMobileViewport() && !isDesktopRuntime()
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)
  const [plusMenuPos, setPlusMenuPos] = useState<{ bottom: number; left: number } | null>(null)
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [fileSearchOpen, setFileSearchOpen] = useState(false)
  const [localSlashPanel, setLocalSlashPanel] = useState<LocalSlashCommandName | null>(null)
  const [atFilter, setAtFilter] = useState('')
  const [atCursorPos, setAtCursorPos] = useState(-1)
  const [slashFilter, setSlashFilter] = useState('')
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0)
  const [agentSlashCommands, setAgentSlashCommands] = useState<ReturnType<typeof buildAgentSlashCommands>>([])
  const [launchWorkDir, setLaunchWorkDir] = useState('')
  const [launchBranch, setLaunchBranch] = useState<string | null>(null)
  const [launchUseWorktree, setLaunchUseWorktree] = useState(false)
  const [launchReady, setLaunchReady] = useState(true)
  const [launchTransitioning, setLaunchTransitioning] = useState(false)
  const composingRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const plusMenuRef = useRef<HTMLDivElement>(null)
  const plusMenuBtnRef = useRef<HTMLButtonElement>(null)
  const plusMenuPortalRef = useRef<HTMLDivElement>(null)
  const slashMenuRef = useRef<HTMLDivElement>(null)
  const fileSearchRef = useRef<FileSearchMenuHandle>(null)
  const slashItemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const previousActiveTabIdRef = useRef<string | null>(null)
  const inputRef = useRef(input)
  const attachmentsRef = useRef(attachments)
  const setComposerInput = useCallback((value: string) => {
    inputRef.current = value
    setInput(value)
  }, [])
  const setComposerAttachments = useCallback((value: Attachment[] | ((previous: Attachment[]) => Attachment[])) => {
    setAttachments((previous) => {
      const next = typeof value === 'function' ? value(previous) : value
      attachmentsRef.current = next
      return next
    })
  }, [])
  const {
    sendMessage,
    stopGeneration,
    clearComposerPrefill,
    clearComposerInsertion,
    queueUserMessage,
  } = useChatStore()
  const activeTabId = useTabStore((s) => s.activeTabId)
  const sessionState = useChatStore((s) => activeTabId ? s.sessions[activeTabId] : undefined)
  const chatState = sessionState?.chatState ?? 'idle'
  const slashCommands = sessionState?.slashCommands ?? []
  const composerPrefill = sessionState?.composerPrefill ?? null
  const composerInsertion = sessionState?.composerInsertion ?? null
  const runtimeSelection = useSessionRuntimeStore((state) =>
    activeTabId ? state.selections[activeTabId] : undefined,
  )
  const currentModel = useSettingsStore((state) => state.currentModel)
  const chatSendBehavior = useSettingsStore((state) => state.chatSendBehavior)
  const runtimeSelectionKey = runtimeSelection
    ? `${runtimeSelection.providerId ?? 'official'}:${runtimeSelection.modelId}:${runtimeSelection.effortLevel ?? 'auto'}`
    : undefined
  const runtimeModelLabel = runtimeSelection?.modelId ?? currentModel?.name ?? currentModel?.id
  const activeSession = useSessionStore((state) => activeTabId ? state.sessions.find((session) => session.id === activeTabId) ?? null : null)
  const loadedMessageCount = sessionState?.messages?.length ?? 0
  const messageCount = Math.max(loadedMessageCount, activeSession?.messageCount ?? 0)
  const memberInfo = useTeamStore((s) => activeTabId ? s.getMemberBySessionId(activeTabId) : null)
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null)
  const workspaceReferences = useWorkspaceChatContextStore(
    (s) => activeTabId ? s.referencesBySession[activeTabId] ?? EMPTY_WORKSPACE_REFERENCES : EMPTY_WORKSPACE_REFERENCES,
  )
  const addWorkspaceReference = useWorkspaceChatContextStore((s) => s.addReference)
  const removeWorkspaceReference = useWorkspaceChatContextStore((s) => s.removeReference)
  const clearWorkspaceReferences = useWorkspaceChatContextStore((s) => s.clearReferences)
  const saveComposerDraft = useCallback((sessionId: string) => {
    const draft = {
      input: inputRef.current,
      attachments: attachmentsRef.current,
    }
    const chatStore = useChatStore.getState()
    if (draft.input.length === 0 && draft.attachments.length === 0) {
      chatStore.clearComposerDraft(sessionId)
      return
    }
    chatStore.setComposerDraft(sessionId, draft)
  }, [])

  const isMemberSession = !!memberInfo
  const isActive = chatState !== 'idle'
  const isWorkspaceMissing = activeSession?.workDirExists === false
  const hasWorkspaceReferences = !isMemberSession && workspaceReferences.length > 0
  const isHeroComposer = variant === 'hero' && !isMemberSession && !compact
  const resolvedWorkDir = activeSession?.workDir || gitInfo?.workDir || undefined
  const showLaunchControls = !isMemberSession && messageCount === 0
  const useCompactControls = compact || isMobileComposer
  const iconOnlyAction = compact || isMobileComposer
  const activeLaunchWorkDir = showLaunchControls ? (launchWorkDir || resolvedWorkDir || '') : (resolvedWorkDir || '')
  const embedLaunchControlsInHero = isHeroComposer && !useCompactControls && showLaunchControls
  const pendingSlashUiAction = !isMemberSession && input.trim().startsWith('/')
    ? resolveSlashUiAction(input.trim().slice(1))
    : null
  const canSubmit = !isWorkspaceMissing &&
    !launchTransitioning &&
    (!showLaunchControls || launchReady || !!pendingSlashUiAction) &&
    (input.trim().length > 0 || (!isMemberSession && (attachments.length > 0 || hasWorkspaceReferences)))
  const composerAttachments = useMemo(
    () => [
      ...attachments,
      ...workspaceReferences.map(workspaceReferenceToAttachment),
    ],
    [attachments, workspaceReferences],
  )
  const slashCommandCount = slashCommands.length

  useEffect(() => {
    inputRef.current = input
  }, [input])

  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])

  useEffect(() => {
    const previousActiveTabId = previousActiveTabIdRef.current

    if (previousActiveTabId === activeTabId) return

    if (previousActiveTabId) {
      saveComposerDraft(previousActiveTabId)
    }

    const nextDraft = activeTabId ? useChatStore.getState().sessions[activeTabId]?.composerDraft : undefined
    setComposerInput(nextDraft?.input ?? '')
    setComposerAttachments(nextDraft?.attachments ?? [])
    setPlusMenuOpen(false)
    setSlashMenuOpen(false)
    setFileSearchOpen(false)
    setLocalSlashPanel(null)
    setSlashFilter('')
    setAtFilter('')
    setAtCursorPos(-1)
    previousActiveTabIdRef.current = activeTabId
  }, [activeTabId, saveComposerDraft, setComposerAttachments, setComposerInput])

  useEffect(() => {
    return () => {
      const currentActiveTabId = previousActiveTabIdRef.current
      if (currentActiveTabId) saveComposerDraft(currentActiveTabId)
    }
  }, [saveComposerDraft])

  useEffect(() => {
    if (!isMobileComposer) textareaRef.current?.focus()
  }, [isActive, isMobileComposer])

  useEffect(() => {
    if (!composerPrefill || !activeTabId) return

    const nextAttachments = (composerPrefill.attachments ?? [])
      .filter((attachment) => attachment.type === 'image' || attachment.data)
      .map((attachment, index) => ({
        id: `composer-prefill-${composerPrefill.nonce}-${index}`,
        name: attachment.name,
        type: attachment.type,
        mimeType: attachment.mimeType,
        previewUrl: attachment.type === 'image' ? attachment.data : undefined,
        data: attachment.data,
      }))

    if (composerPrefill.mode === 'append') {
      setComposerAttachments((previous) => [...previous, ...nextAttachments])
    } else {
      setComposerInput(composerPrefill.text)
      setComposerAttachments(nextAttachments)
    }
    setPlusMenuOpen(false)
    setSlashMenuOpen(false)
    setFileSearchOpen(false)
    setSlashFilter('')
    setAtFilter('')
    setAtCursorPos(-1)

    requestAnimationFrame(() => {
      const el = textareaRef.current
      el?.focus()
      if (composerPrefill.mode !== 'append') {
        const cursor = composerPrefill.text.length
        el?.setSelectionRange(cursor, cursor)
      }
    })
    clearComposerPrefill(activeTabId, composerPrefill.nonce)
  }, [
    activeTabId,
    clearComposerPrefill,
    composerPrefill,
    setComposerAttachments,
    setComposerInput,
  ])

  useEffect(() => {
    if (!composerInsertion || !activeTabId || isMemberSession) return

    const el = textareaRef.current
    const currentInput = inputRef.current
    const start = el?.selectionStart ?? currentInput.length
    const end = el?.selectionEnd ?? start
    const next = insertComposerTokenAtRange(currentInput, start, end, composerInsertion.text)

    if (composerInsertion.reference) {
      addWorkspaceReference(activeTabId, composerInsertion.reference)
    }
    setComposerInput(next.value)
    setFileSearchOpen(false)
    setSlashMenuOpen(false)
    setAtFilter('')
    setAtCursorPos(-1)
    clearComposerInsertion(activeTabId, composerInsertion.nonce)

    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(next.cursorPos, next.cursorPos)
    })
  }, [
    activeTabId,
    addWorkspaceReference,
    clearComposerInsertion,
    composerInsertion,
    isMemberSession,
    setComposerInput,
  ])

  const refreshGitInfo = useCallback(() => {
    if (!activeTabId) {
      setGitInfo(null)
      return
    }
    if (isMemberSession) {
      setGitInfo(null)
      return
    }
    sessionsApi.getGitInfo(activeTabId).then(setGitInfo).catch(() => setGitInfo(null))
  }, [activeTabId, isMemberSession])

  useEffect(() => {
    refreshGitInfo()
  }, [refreshGitInfo])

  useEffect(() => {
    if (!activeTabId || isMemberSession || messageCount === 0) return
    const timeout = setTimeout(refreshGitInfo, chatState === 'idle' ? 0 : 500)
    return () => clearTimeout(timeout)
  }, [activeTabId, chatState, isMemberSession, messageCount, refreshGitInfo, slashCommandCount])

  useEffect(() => {
    if (!isMemberSession) return
    setComposerAttachments([])
    setPlusMenuOpen(false)
    setSlashMenuOpen(false)
    setFileSearchOpen(false)
  }, [isMemberSession, activeTabId])

  useEffect(() => {
    if (isMemberSession) {
      setAgentSlashCommands([])
      return
    }

    let cancelled = false
    agentsApi.list(resolvedWorkDir)
      .then(({ activeAgents }) => {
        if (cancelled) return
        setAgentSlashCommands(buildAgentSlashCommands(activeAgents))
      })
      .catch(() => {
        if (!cancelled) setAgentSlashCommands([])
      })

    return () => {
      cancelled = true
    }
  }, [isMemberSession, resolvedWorkDir])

  useEffect(() => {
    if (!showLaunchControls) return
    const nextWorkDir = activeSession?.workDir || gitInfo?.workDir || ''
    setLaunchWorkDir((current) => {
      if (current === nextWorkDir) return current
      setLaunchBranch(null)
      setLaunchUseWorktree(false)
      setLaunchReady(!nextWorkDir)
      return nextWorkDir
    })
  }, [activeSession?.workDir, activeTabId, gitInfo?.workDir, showLaunchControls])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  useLayoutEffect(() => {
    if (!plusMenuOpen) {
      setPlusMenuPos(null)
      return
    }
    const anchor = plusMenuBtnRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    setPlusMenuPos({
      bottom: window.innerHeight - rect.top + 8,
      left: rect.left,
    })
  }, [plusMenuOpen])

  useEffect(() => {
    if (!plusMenuOpen) return
    const handleClick = (event: MouseEvent) => {
      if (
        plusMenuBtnRef.current?.contains(event.target as Node) ||
        plusMenuPortalRef.current?.contains(event.target as Node)
      ) return
      setPlusMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [plusMenuOpen])

  useEffect(() => {
    if (!slashMenuOpen) return
    const handleClick = (event: MouseEvent) => {
      if (
        slashMenuRef.current &&
        !slashMenuRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setSlashMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [slashMenuOpen])

  useEffect(() => {
    if (!localSlashPanel) return
    const handleClick = (event: MouseEvent) => {
      if (
        slashMenuRef.current &&
        !slashMenuRef.current.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setLocalSlashPanel(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [localSlashPanel])

  useEffect(() => {
    if (!fileSearchOpen) return
    const handleClick = (event: MouseEvent) => {
      const menu = document.getElementById('file-search-menu')
      if (
        menu &&
        !menu.contains(event.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setFileSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [fileSearchOpen])

  const allSlashCommands = useMemo(
    () => appendAgentSlashCommands(
      mergeSlashCommands(slashCommands, getLocalizedFallbackCommands(t)),
      agentSlashCommands,
    ),
    [agentSlashCommands, slashCommands, t],
  )

  const filteredCommands = useMemo(() => {
    return filterSlashCommands(allSlashCommands, slashFilter)
  }, [allSlashCommands, slashFilter])

  const exactSlashCommand = useMemo(() => {
    const normalized = slashFilter.trim().toLowerCase()
    if (!normalized) return null
    return filteredCommands.find((command) => command.name.toLowerCase() === normalized) ?? null
  }, [filteredCommands, slashFilter])

  useEffect(() => {
    setSlashSelectedIndex(0)
  }, [slashFilter])

  useEffect(() => {
    const activeItem = slashMenuOpen ? slashItemRefs.current[slashSelectedIndex] : null
    if (activeItem && typeof activeItem.scrollIntoView === 'function') {
      activeItem.scrollIntoView({ block: 'nearest' })
    }
  }, [slashMenuOpen, slashSelectedIndex])

  const detectSlashTrigger = useCallback((value: string, cursorPos: number) => {
    const token = findSlashTrigger(value, cursorPos)
    if (!token) {
      setSlashMenuOpen(false)
      return
    }

    setFileSearchOpen(false)
    setSlashFilter(token.filter)
    setSlashMenuOpen(true)
  }, [])

  // Detect @ trigger (file search)
  const detectAtTrigger = useCallback((value: string, cursorPos: number) => {
    const textBeforeCursor = value.slice(0, cursorPos)
    let pos = -1

    for (let i = textBeforeCursor.length - 1; i >= 0; i--) {
      const ch = textBeforeCursor[i]!
      if (ch === '@') {
        if (i === 0 || /\s/.test(textBeforeCursor[i - 1]!)) {
          pos = i
          break
        }
        break
      }
      if (/\s/.test(ch)) {
        break
      }
    }

    if (pos < 0) {
      setFileSearchOpen(false)
      setAtFilter('')
      setAtCursorPos(-1)
      return
    }

    // Extract filter text after @
    const filter = textBeforeCursor.slice(pos + 1)
    setAtFilter(filter)
    setAtCursorPos(pos)
    setSlashMenuOpen(false)
    setFileSearchOpen(true)
  }, [])

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value
    if (isMemberSession) {
      setComposerInput(value)
      return
    }
    const cursorPos = event.target.selectionStart ?? value.length
    setComposerInput(value)
    detectSlashTrigger(value, cursorPos)
    detectAtTrigger(value, cursorPos)
  }

  const selectSlashCommand = useCallback((command: string) => {
    const el = textareaRef.current
    if (!el) return
    const cursorPos = el.selectionStart ?? input.length
    const replacement = replaceSlashToken(input, cursorPos, command)
    setComposerInput(replacement.value)
    setSlashMenuOpen(false)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(replacement.cursorPos, replacement.cursorPos)
    })
  }, [input])

  const replaceEmptySession = useCallback(async (
    workDir: string,
    repository?: { branch?: string | null; worktree?: boolean },
  ) => {
    if (!activeTabId) return null
    const oldId = activeTabId
    const { createSession, deleteSession } = useSessionStore.getState()
    const { replaceTabSession } = useTabStore.getState()
    const { disconnectSession, connectToSession } = useChatStore.getState()
    const newId = await createSession(
      workDir || undefined,
      repository ? { repository } : undefined,
    )
    useSessionRuntimeStore.getState().moveSelection(oldId, newId)
    disconnectSession(oldId)
    replaceTabSession(oldId, newId)
    connectToSession(newId)
    deleteSession(oldId).catch(() => {})
    return newId
  }, [activeTabId])

  const handleLaunchWorkDirChange = useCallback(async (newWorkDir: string) => {
    setLaunchWorkDir(newWorkDir)
    setLaunchBranch(null)
    setLaunchUseWorktree(false)
    setLaunchReady(!newWorkDir)
    if (!activeTabId) return

    setLaunchTransitioning(true)
    try {
      await replaceEmptySession(newWorkDir)
    } catch (error) {
      useUIStore.getState().addToast({
        type: 'error',
        message: error instanceof Error ? error.message : t('empty.failedToCreate'),
      })
    } finally {
      setLaunchTransitioning(false)
    }
  }, [activeTabId, replaceEmptySession, t])

  const handleSubmit = async () => {
    const text = input.trim()
    if ((!text && ((!attachments.length && !hasWorkspaceReferences) || isMemberSession)) || isWorkspaceMissing) return

    if (pendingSlashUiAction?.type === 'panel') {
      setLocalSlashPanel(pendingSlashUiAction.command as LocalSlashCommandName)
      setComposerInput('')
      setSlashMenuOpen(false)
      setFileSearchOpen(false)
      setPlusMenuOpen(false)
      return
    }

    if (pendingSlashUiAction?.type === 'settings') {
      useUIStore.getState().setPendingSettingsTab(pendingSlashUiAction.tab)
      useTabStore.getState().openTab(SETTINGS_TAB_ID, 'Settings', 'settings')
      setComposerInput('')
      setSlashMenuOpen(false)
      setFileSearchOpen(false)
      setPlusMenuOpen(false)
      return
    }

    if (showLaunchControls && (!launchReady || launchTransitioning)) return

    onSubmitStart?.()

    const workspaceReferencePrompt = !isMemberSession
      ? formatWorkspaceReferencePrompt(workspaceReferences)
      : ''
    const contentForModel = [workspaceReferencePrompt, text].filter(Boolean).join('\n\n')
    const displayContent = text || (
      workspaceReferences.length > 0
        ? t('chat.contextReferencesOnly', { count: workspaceReferences.length })
        : ''
    )
    const uploadAttachmentPayload: AttachmentRef[] = attachments.map((attachment) => ({
      type: attachment.type,
      name: attachment.name,
      path: attachment.path,
      data: attachment.data,
      mimeType: attachment.mimeType,
      lineStart: attachment.lineStart,
      lineEnd: attachment.lineEnd,
      note: attachment.note,
      quote: attachment.quote,
    }))
    const workspaceAttachmentPayload: AttachmentRef[] = workspaceReferences
      .filter((reference) => reference.kind !== 'chat-selection')
      .map((reference) => ({
        type: 'file' as const,
        name: reference.name,
        path: reference.absolutePath ?? reference.path,
        isDirectory: reference.isDirectory,
        lineStart: reference.lineStart,
        lineEnd: reference.lineEnd,
        note: reference.note,
        quote: reference.quote,
      }))
    const visibleAttachmentPayload: AttachmentRef[] = [
      ...uploadAttachmentPayload,
      ...workspaceReferences.map((reference) => ({
        type: 'file' as const,
        name: reference.name,
        path: reference.kind === 'chat-selection' ? undefined : reference.path,
        isDirectory: reference.isDirectory,
        lineStart: reference.lineStart,
        lineEnd: reference.lineEnd,
        note: reference.note,
        quote: reference.quote,
      })),
    ]

    let targetSessionId = activeTabId!
    if (showLaunchControls && activeLaunchWorkDir && launchBranch) {
      const shouldReplaceForRepositoryLaunch =
        launchUseWorktree ||
        (gitInfo?.branch ? launchBranch !== gitInfo.branch : true)
      if (shouldReplaceForRepositoryLaunch) {
        setLaunchTransitioning(true)
        try {
          const newSessionId = await replaceEmptySession(activeLaunchWorkDir, {
            branch: launchBranch,
            worktree: launchUseWorktree,
          })
          if (!newSessionId) return
          targetSessionId = newSessionId
        } catch (error) {
          useUIStore.getState().addToast({
            type: 'error',
            message: error instanceof Error ? error.message : t('empty.failedToCreate'),
          })
          return
        } finally {
          setLaunchTransitioning(false)
        }
      }
    }

    const targetChatState = useChatStore.getState().sessions[targetSessionId]?.chatState ?? 'idle'
    if (!isMemberSession && targetChatState !== 'idle') {
      queueUserMessage(targetSessionId, {
        content: contentForModel,
        attachments: [...uploadAttachmentPayload, ...workspaceAttachmentPayload],
        displayContent,
        displayAttachments: visibleAttachmentPayload,
      })
    } else {
      sendMessage(targetSessionId, contentForModel, [...uploadAttachmentPayload, ...workspaceAttachmentPayload], {
        displayContent,
        displayAttachments: visibleAttachmentPayload,
      })
    }
    setComposerInput('')
    setComposerAttachments([])
    useChatStore.getState().clearComposerDraft(activeTabId!)
    if (targetSessionId !== activeTabId) useChatStore.getState().clearComposerDraft(targetSessionId)
    if (!isMemberSession) {
      clearWorkspaceReferences(activeTabId!)
      if (targetSessionId !== activeTabId) clearWorkspaceReferences(targetSessionId)
    }
    setPlusMenuOpen(false)
    setSlashMenuOpen(false)
    setFileSearchOpen(false)
    setLocalSlashPanel(null)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Ignore key events during IME composition (e.g. Chinese input method)
    if (composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) return

    // Route file search navigation keys to FileSearchMenu
    if (fileSearchOpen) {
      const key = event.key
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'ArrowRight' || key === 'Enter' || key === 'Tab' || key === 'Escape') {
        event.preventDefault()
        if (key === 'Escape') {
          setFileSearchOpen(false)
          setAtFilter('')
          setAtCursorPos(-1)
          return
        }
        fileSearchRef.current?.handleKeyDown(event.nativeEvent)
        return
      }
      // Other keys (typing) should go to the textarea - let it propagate
      return
    }

    if (localSlashPanel) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setLocalSlashPanel(null)
        return
      }
    }

    if (slashMenuOpen && filteredCommands.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSlashSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSlashSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length)
        return
      }
      if (event.key === 'Enter') {
        const selected = filteredCommands[slashSelectedIndex]
        if (
          exactSlashCommand &&
          selected?.name.toLowerCase() === exactSlashCommand.name.toLowerCase() &&
          slashFilter.trim().toLowerCase() === exactSlashCommand.name.toLowerCase() &&
          shouldSubmitOnEnter(event, chatSendBehavior)
        ) {
          event.preventDefault()
          handleSubmit()
          return
        }
        event.preventDefault()
        if (selected) selectSlashCommand(selected.name)
        return
      }
      if (event.key === 'Tab') {
        event.preventDefault()
        const selected = filteredCommands[slashSelectedIndex]
        if (selected) selectSlashCommand(selected.name)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setSlashMenuOpen(false)
        return
      }
    }

    if (shouldSubmitOnEnter(event, chatSendBehavior)) {
      event.preventDefault()
      handleSubmit()
    }
  }

  const handlePaste = (event: React.ClipboardEvent) => {
    if (isMemberSession) return
    const items = event.clipboardData?.items
    if (!items) return

    let hasImage = false
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      if (!item || !item.type.startsWith('image/')) continue

      hasImage = true
      event.preventDefault()
      const file = item.getAsFile()
      if (!file) continue

      const id = `att-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const reader = new FileReader()
      reader.onload = () => {
        setComposerAttachments((prev) => [
          ...prev,
          {
            id,
            name: `pasted-image-${Date.now()}.png`,
            type: 'image',
            mimeType: file.type || 'image/png',
            previewUrl: reader.result as string,
            data: reader.result as string,
          },
        ])
      }
      reader.readAsDataURL(file)
    }

    if (!hasImage) return
  }

  const appendFiles = useCallback((files: FileList | File[]) => {
    void filesToComposerAttachments(files)
      .then((nextAttachments) => {
        if (nextAttachments.length === 0) return
        setComposerAttachments((prev) => [...prev, ...nextAttachments])
      })
      .catch((error) => {
        console.warn('[attachments] Failed to read selected files', error)
      })
  }, [setComposerAttachments])

  const appendAttachments = useCallback((nextAttachments: Attachment[]) => {
    if (nextAttachments.length === 0) return
    setComposerAttachments((prev) => [...prev, ...nextAttachments])
  }, [setComposerAttachments])

  const { isDragActive, dragHandlers } = useComposerFileDrop({
    disabled: isMemberSession || isWorkspaceMissing,
    panelRef,
    onAttachments: appendAttachments,
    onError: (error) => {
      console.warn('[attachments] Failed to read dropped files', error)
    },
  })

  const openAttachmentPicker = useCallback(() => {
    setPlusMenuOpen(false)
    if (!isDesktopRuntime()) {
      fileInputRef.current?.click()
      return
    }

    void selectNativeFileAttachments()
      .then((nativeAttachments) => {
        if (nativeAttachments) {
          if (nativeAttachments.length > 0) {
            setComposerAttachments((prev) => [...prev, ...nativeAttachments])
          }
          return
        }
        fileInputRef.current?.click()
      })
  }, [setComposerAttachments])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isMemberSession) return
    const files = event.target.files
    if (!files) return

    appendFiles(files)
    event.target.value = ''
  }

  const removeAttachment = (id: string) => {
    setComposerAttachments((prev) => prev.filter((attachment) => attachment.id !== id))
    if (activeTabId) removeWorkspaceReference(activeTabId, id)
  }

  const insertSlashCommand = () => {
    if (isMemberSession) return
    const el = textareaRef.current
    const cursorPos = el?.selectionStart ?? input.length
    const replacement = replaceSlashToken(input, cursorPos, '', { trailingSpace: false })
    setComposerInput(replacement.value)
    setPlusMenuOpen(false)
    setSlashFilter('')
    setSlashMenuOpen(true)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(replacement.cursorPos, replacement.cursorPos)
    })
  }

  const composerPlaceholder =
    isHeroComposer
      ? t('empty.placeholder')
      : isWorkspaceMissing
        ? t('chat.placeholderMissing')
        : isMemberSession
          ? t('teams.memberPlaceholder')
          : t('chat.placeholder')

  const addFilesLabel = isHeroComposer ? t('empty.addFiles') : t('chat.addFiles')
  const slashCommandsLabel = isHeroComposer ? t('empty.slashCommands') : t('chat.slashCommands')

  return (
    <div
      data-testid="chat-input-shell"
      className={
        isHeroComposer
          ? `bg-transparent ${isMobileComposer ? 'px-1 pb-3' : 'px-8 pb-4'}`
          : compact
            ? `bg-transparent ${isMobileComposer ? 'px-1 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-0' : 'px-2 pb-2 pt-0'}`
            : `bg-transparent ${isMobileComposer ? 'px-1 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-0' : 'px-0 pb-[16px] pt-0'}`
      }
    >
      <div
        className={
          isHeroComposer
            ? 'codex-new-task-composer mx-auto flex w-full max-w-[760px] flex-col'
          : compact
              ? 'mx-auto max-w-full'
              : `${isMobileComposer ? 'mx-0 max-w-none' : 'relative mx-auto max-w-[800px]'}`
        }
      >
        {isHeroComposer && heroTitle ? (
          <h2 className="codex-new-task-title" data-testid="new-task-hero-title">
            {heroTitle}
          </h2>
        ) : null}

        <div
          ref={panelRef}
          data-testid="chat-input-panel"
          className={isHeroComposer
            ? `glass-panel codex-new-task-input-panel relative flex flex-col gap-2 overflow-visible ${embedLaunchControlsInHero ? 'rounded-[var(--radius-4xl)]' : 'rounded-t-[var(--radius-4xl)] rounded-b-none'} p-3 transition-colors ${isDragActive ? 'composer-drop-target-active' : ''}`
            : compact
              ? `glass-panel relative overflow-visible ${isMobileComposer ? 'p-2' : 'p-3'} transition-colors ${isMobileComposer ? 'rounded-[var(--radius-2xl)] shadow-[0_-12px_36px_rgba(15,23,42,0.12)]' : 'rounded-[var(--radius-3xl)]'} ${isDragActive ? 'composer-drop-target-active' : ''}`
              : `glass-panel relative overflow-visible transition-colors ${isMobileComposer ? 'rounded-[var(--radius-2xl)] p-2 shadow-[0_-12px_36px_rgba(15,23,42,0.12)]' : 'rounded-[var(--radius-3xl)] pt-[10px] pb-3 px-4 -ml-[8px] w-[calc(100%+8px)]'} ${isDragActive ? 'composer-drop-target-active' : ''}`}
          {...dragHandlers}
        >
          {isDragActive && (
            <ComposerDropOverlay
              testId="chat-input-drop-overlay"
              title={t('chat.dropFilesTitle')}
              description={t('chat.dropFilesHint')}
            />
          )}

          {isActive && <ClawdPersona width={80} height={55} className="absolute -top-[55px] right-2 z-5" />}

          {!isMemberSession && fileSearchOpen && (
            <FileSearchMenu
              ref={fileSearchRef}
              cwd={activeLaunchWorkDir || resolvedWorkDir || ''}
              filter={atFilter}
              compact={isMobileComposer}
              onNavigate={(relativePath) => {
                if (atCursorPos < 0) return
                const replacement = `@${relativePath}`
                const tokenEnd = atCursorPos + 1 + atFilter.length
                const newValue = `${input.slice(0, atCursorPos)}${replacement}${input.slice(tokenEnd)}`
                const newCursorPos = atCursorPos + replacement.length
                setComposerInput(newValue)
                setAtFilter(relativePath)
                requestAnimationFrame(() => {
                  textareaRef.current?.focus()
                  textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos)
                })
              }}
              onSelect={(path, name, isDirectory) => {
                if (atCursorPos >= 0) {
                  const referenceName = name.split('/').filter(Boolean).pop() ?? name
                  const tokenEnd = atCursorPos + 1 + atFilter.length
                  const beforeToken = input.slice(0, atCursorPos)
                  const afterToken = beforeToken ? input.slice(tokenEnd) : input.slice(tokenEnd).replace(/^\s+/, '')
                  const spacer = beforeToken && afterToken && !/\s$/.test(beforeToken) && !/^\s/.test(afterToken) ? ' ' : ''
                  const newValue = `${beforeToken}${spacer}${afterToken}`
                  const newCursorPos = atCursorPos + spacer.length
                  if (activeTabId) {
                    addWorkspaceReference(activeTabId, {
                      kind: 'file',
                      path,
                      absolutePath: path,
                      name: isDirectory ? `${referenceName}/` : referenceName,
                      isDirectory,
                    })
                  }
                  setComposerInput(newValue)
                  setFileSearchOpen(false)
                  setAtFilter('')
                  setAtCursorPos(-1)
                  void textareaRef.current?.focus()
                  requestAnimationFrame(() => {
                    textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos)
                  })
                }
              }}
            />
          )}

          {!isMemberSession && localSlashPanel && (
            <div ref={slashMenuRef}>
              <LocalSlashCommandPanel
                command={localSlashPanel}
                sessionId={activeTabId ?? undefined}
                cwd={activeLaunchWorkDir || resolvedWorkDir}
                commands={allSlashCommands}
                onClose={() => setLocalSlashPanel(null)}
              />
            </div>
          )}

          {!isMemberSession && slashMenuOpen && filteredCommands.length > 0 && (
              <div
              ref={slashMenuRef}
	              className="composer-top-tray-panel absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden p-1.5 shadow-[var(--shadow-dropdown)]"
            >
              <div className="max-h-[300px] overflow-y-auto">
                {filteredCommands.map((command, index) => (
                  <button
                    key={command.name}
                    ref={(el) => { slashItemRefs.current[index] = el }}
                    onClick={() => selectSlashCommand(command.name)}
                    onMouseEnter={() => setSlashSelectedIndex(index)}
                    className={`sidebar-codex-menu-item items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 ${
                      index === slashSelectedIndex ? 'bg-white/[0.085]' : ''
                    }`}
                  >
                    <span className="flex min-w-0 max-w-[52%] shrink-0 items-baseline gap-1.5">
                      <span className="shrink-0 text-[13px] font-semibold text-[var(--color-token-foreground)]">
	                        /{command.name}
	                      </span>
	                      {command.argumentHint ? (
	                        <span className="min-w-0 truncate font-mono text-[11px] text-[var(--color-token-text-secondary)]">
	                          {command.argumentHint}
	                        </span>
	                      ) : null}
	                    </span>
	                    <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--color-token-text-secondary)]">
                      {command.description}
                    </span>
                  </button>
                ))}
              </div>
              {!isMobileComposer ? (
                <>
                  <div className="sidebar-codex-menu-divider" />
                  <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-[var(--color-token-text-secondary)]">
	                  <kbd className="rounded border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 font-mono text-[10px]">Up/Down</kbd>
	                  <span>{t('chat.navigate')}</span>
	                  <kbd className="ml-2 rounded border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>
	                  <span>{t('chat.select')}</span>
	                  <kbd className="ml-2 rounded border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>
                    <span>{t('chat.dismiss')}</span>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {!isMemberSession && activeTabId && (
            <QueuedPrompts sessionId={activeTabId} />
          )}

          {composerAttachments.length > 0 && (
            isHeroComposer ? (
              <div className="composer-attachments-area">
                <AttachmentGallery attachments={composerAttachments} variant="composer" onRemove={removeAttachment} />
              </div>
            ) : (
              <div className="composer-attachments-area px-1 pt-1">
                <AttachmentGallery attachments={composerAttachments} variant="composer" onRemove={removeAttachment} />
              </div>
            )
          )}

          {isHeroComposer ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-2 relative">
                {!input && !isWorkspaceMissing && (
                  <span
                    className="shimmer-sweep-text pointer-events-none absolute top-0 left-0 py-1.5 leading-6 text-[13px]"
                    aria-hidden="true"
                  >
                    {composerPlaceholder}
                  </span>
                )}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onCompositionStart={() => { composingRef.current = true }}
                  onCompositionEnd={() => { composingRef.current = false }}
                  onPaste={handlePaste}
                  placeholder=""
                  disabled={isWorkspaceMissing}
                  rows={1}
                  className="flex-1 resize-none border-none bg-transparent py-1.5 leading-6 text-[13px] text-[var(--color-token-foreground)] outline-none disabled:opacity-50"
                />
              </div>
            </div>
          ) : (
            <div className="relative">
              {!input && !isWorkspaceMissing && (
                <span
                  className={`shimmer-sweep-text pointer-events-none absolute top-0 left-0 text-[13px] leading-6 ${
                    useCompactControls ? 'py-1' : 'py-1.5'
                  }`}
                  aria-hidden="true"
                >
                  {composerPlaceholder}
                </span>
              )}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => { composingRef.current = true }}
                onCompositionEnd={() => { composingRef.current = false }}
                onPaste={handlePaste}
                placeholder=""
                disabled={isWorkspaceMissing}
                rows={1}
                className={`w-full resize-none bg-transparent text-[13px] leading-6 text-[var(--color-token-foreground)] outline-none disabled:opacity-50 ${
                  useCompactControls ? 'py-1' : 'py-1.5'
                }`}
              />
            </div>
          )}

          <div data-testid="chat-input-toolbar" className={`composer-footer ${isHeroComposer
            ? 'flex items-center justify-between pt-2'
            : `mt-1 flex items-center justify-between ${
              useCompactControls ? '-mx-3 -mb-3 gap-2 px-2.5 py-2' : '-mx-4 -mb-3 px-3 py-2'
            }`}`}>
            <div className="flex min-w-0 items-center gap-2">
              {!isMemberSession && (
                <>
                  <div ref={plusMenuRef} className="relative">
                    <button
                      ref={plusMenuBtnRef}
                      onClick={() => setPlusMenuOpen((value) => !value)}
                      aria-label="Open composer tools"
                      className={`text-[var(--color-token-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-token-foreground)] ${isMobileComposer ? 'inline-flex h-11 w-11 items-center justify-center rounded-xl' : 'rounded-[var(--radius-sm)] p-1.5'}`}
                    >
                      <span className="material-symbols-outlined icon-md">add</span>
                    </button>

                    {plusMenuOpen && plusMenuPos && createPortal(
                      <div
                        ref={plusMenuPortalRef}
                        className="liquid-glass glass-panel fixed z-[80] w-[240px] overflow-hidden rounded-[var(--radius-2xl)] p-1.5 shadow-[var(--shadow-dropdown)]"
                        style={{ bottom: plusMenuPos.bottom, left: plusMenuPos.left }}
                      >
                        <button
                          onClick={() => { openAttachmentPicker(); setPlusMenuOpen(false) }}
                          className="sidebar-codex-menu-item w-full rounded-[var(--radius-md)]"
                        >
                          <span className="material-symbols-outlined icon-md text-[var(--color-token-text-secondary)]">attach_file</span>
                          <span className="text-sm text-[var(--color-token-foreground)]">{addFilesLabel}</span>
                        </button>
                        <button
                          onClick={() => { insertSlashCommand(); setPlusMenuOpen(false) }}
                          className="sidebar-codex-menu-item w-full rounded-[var(--radius-md)]"
                        >
                          <span className="w-[24px] text-center text-[18px] font-bold text-[var(--color-token-text-secondary)]">/</span>
                          <span className="text-sm text-[var(--color-token-foreground)]">{slashCommandsLabel}</span>
                        </button>
                      </div>,
                      document.body,
                    )}
                  </div>

                  <PermissionModeSelector compact={useCompactControls} />
                </>
              )}
            </div>

            <div className="flex min-w-0 items-center gap-2">
              {!isMemberSession && activeTabId && (
                <ContextUsageIndicator
                  sessionId={activeTabId}
                  chatState={chatState}
                  messageCount={messageCount}
                  runtimeSelectionKey={runtimeSelectionKey}
                  fallbackModelLabel={runtimeModelLabel}
                  compact={useCompactControls}
                  refreshNonce={sessionState?.compactCount ?? 0}
                />
              )}
              {!isMemberSession && activeTabId && (
                <ModelSelector runtimeKey={activeTabId} disabled={isActive} compact={useCompactControls} />
              )}
              <button
                onClick={!isMemberSession && isActive ? () => stopGeneration(activeTabId!) : handleSubmit}
                disabled={!isMemberSession && isActive ? false : !canSubmit}
                aria-label={!isMemberSession && isActive ? t('common.stop') : isMemberSession ? t('common.send') : t('common.run')}
                title={
                  !isMemberSession && isActive
                    ? t('chat.stopTitle')
                    : iconOnlyAction
                      ? isMemberSession
                        ? t('common.send')
                        : t('common.run')
                      : undefined
                }
                className={`flex shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all hover:scale-[1.04] disabled:opacity-35 bg-white text-black hover:brightness-95 ${
                  isMobileComposer ? 'h-10 w-10' : 'h-9 w-9'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20, width: 20, height: 20, lineHeight: 1 }}>
                  {!isMemberSession && isActive ? 'stop' : 'arrow_upward'}
                </span>
              </button>
            </div>
          </div>

          {embedLaunchControlsInHero && (
            <div className="-mx-3 -mb-3 mt-2">
              <RepositoryLaunchControls
                workDir={activeLaunchWorkDir}
                onWorkDirChange={handleLaunchWorkDirChange}
                branch={launchBranch}
                onBranchChange={setLaunchBranch}
                useWorktree={launchUseWorktree}
                onUseWorktreeChange={setLaunchUseWorktree}
                onLaunchReadyChange={setLaunchReady}
                disabled={isActive || launchTransitioning}
                placement="composer"
              />
            </div>
          )}
        </div>

        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />

        {isHeroComposer && heroRecentItems.length > 0 ? (
          <div className="codex-new-task-recent-list" data-testid="new-task-recent-list">
            {heroRecentItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="codex-new-task-recent-row"
                onClick={() => onOpenHeroRecentItem?.(item.id)}
                title={`${item.projectLabel} · ${item.title}`}
              >
                <span className="material-symbols-outlined icon-sm shrink-0 text-[var(--color-token-text-secondary)]">folder_open</span>
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <span className="hidden min-w-0 max-w-[220px] truncate text-[var(--color-token-text-secondary)] sm:block">{item.projectLabel}</span>
                {item.meta ? <span className="shrink-0 text-[var(--color-token-text-secondary)]">{item.meta}</span> : null}
              </button>
            ))}
          </div>
        ) : null}

        {!isMemberSession && !embedLaunchControlsInHero && messageCount === 0 && (
          <div className={useCompactControls ? 'mt-2 flex min-w-0 px-1' : 'mt-3 px-1'}>
            <RepositoryLaunchControls
              workDir={activeLaunchWorkDir}
              onWorkDirChange={handleLaunchWorkDirChange}
              branch={launchBranch}
              onBranchChange={setLaunchBranch}
              useWorktree={launchUseWorktree}
              onUseWorktreeChange={setLaunchUseWorktree}
              onLaunchReadyChange={setLaunchReady}
              disabled={isActive || launchTransitioning}
            />
          </div>
        )}
      </div>
    </div>
  )
}
