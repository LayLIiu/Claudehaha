/**
 * Chat screen — Real-time chat with streaming render + permission handling
 */

import { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import {
  useMessages,
  useChatState,
  usePendingPermission,
  useSessionTitle,
  useClaudeActions,
} from '../src/hooks/useClaudeService'
import type { ChatMessage } from '../src/services/ClaudeService'

export default function ChatScreen() {
  const messages = useMessages()
  const chatState = useChatState()
  const pendingPermission = usePendingPermission()
  const sessionTitle = useSessionTitle()
  const { sendMessage, sendPermissionResponse, stopGeneration } = useClaudeActions()

  const [inputText, setInputText] = useState('')
  const flatListRef = useRef<FlatList>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages.length])

  const handleSend = () => {
    const text = inputText.trim()
    if (!text) return
    sendMessage(text)
    setInputText('')
  }

  const isGenerating = chatState !== 'idle'

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.role === 'user') {
      return (
        <View style={styles.userMessage}>
          <Text style={styles.userText}>{item.content}</Text>
        </View>
      )
    }

    // Assistant message
    return (
      <View style={styles.assistantMessage}>
        {item.isThinking && (
          <Text style={styles.thinkingLabel}>Thinking</Text>
        )}
        {item.toolName && (
          <View style={styles.toolHeader}>
            <Text style={styles.toolName}>🔧 {item.toolName}</Text>
          </View>
        )}
        {item.content ? (
          <Text style={styles.assistantText}>{item.content}</Text>
        ) : null}
        {item.toolInput && (
          <View style={styles.toolInputBox}>
            <Text style={styles.toolInputText} numberOfLines={3}>
              {item.toolInput}
            </Text>
          </View>
        )}
        {item.toolResult !== undefined && (
          <View style={styles.toolResultBox}>
            <Text style={styles.toolResultText} numberOfLines={5}>
              {typeof item.toolResult === 'string'
                ? item.toolResult
                : JSON.stringify(item.toolResult, null, 2)}
            </Text>
          </View>
        )}
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Chat header */}
      <View style={styles.chatHeader}>
        <Text style={styles.chatTitle} numberOfLines={1}>
          {sessionTitle || 'Chat'}
        </Text>
        {isGenerating && (
          <View style={styles.generatingBadge}>
            <View style={styles.generatingDot} />
            <Text style={styles.generatingText}>
              {chatState === 'thinking'
                ? 'Thinking'
                : chatState === 'streaming'
                  ? 'Writing'
                  : chatState === 'tool_executing'
                    ? 'Running tool'
                    : chatState === 'permission_pending'
                      ? 'Awaiting permission'
                      : chatState}
            </Text>
          </View>
        )}
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatText}>
              Send a message to start chatting
            </Text>
          </View>
        }
      />

      {/* Permission request overlay */}
      {pendingPermission && (
        <View style={styles.permissionOverlay}>
          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>Permission Request</Text>
            <Text style={styles.permissionTool}>
              🔧 {pendingPermission.toolName}
            </Text>
            {pendingPermission.description && (
              <Text style={styles.permissionDesc}>
                {pendingPermission.description}
              </Text>
            )}
            <View style={styles.permissionButtons}>
              <TouchableOpacity
                style={[styles.permButton, styles.denyButton]}
                onPress={() =>
                  sendPermissionResponse(pendingPermission.requestId思考已达上限，停止思考，开始回答。</think><tool_call>Write<arg_key>content</arg_key><arg_value>/**
 * Chat screen — Real-time chat with streaming render + permission handling
 */

import { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import {
  useMessages,
  useChatState,
  usePendingPermission,
  useSessionTitle,
  useClaudeActions,
} from '../src/hooks/useClaudeService'
import type { ChatMessage } from '../src/services/ClaudeService'

export default function ChatScreen() {
  const messages = useMessages()
  const chatState = useChatState()
  const pendingPermission = usePendingPermission()
  const sessionTitle = useSessionTitle()
  const { sendMessage, sendPermissionResponse, stopGeneration } = useClaudeActions()

  const [inputText, setInputText] = useState('')
  const flatListRef = useRef<FlatList>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages.length])

  const handleSend = () => {
    const text = inputText.trim()
    if (!text) return
    sendMessage(text)
    setInputText('')
  }

  const isGenerating = chatState !== 'idle'

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.role === 'user') {
      return (
        <View style={styles.userMessage}>
          <Text style={styles.userText}>{item.content}</Text>
        </View>
      )
    }

    // Assistant message
    return (
      <View style={styles.assistantMessage}>
        {item.isThinking && (
          <Text style={styles.thinkingLabel}>💭 Thinking</Text>
        )}
        {item.toolName && (
          <View style={styles.toolHeader}>
            <Text style={styles.toolName}>🔧 {item.toolName}</Text>
          </View>
        )}
        {item.content ? (
          <Text style={styles.assistantText}>{item.content}</Text>
        ) : null}
        {item.toolInput && (
          <View style={styles.toolInputBox}>
            <Text style={styles.toolInputText} numberOfLines={3}>
              {item.toolInput}
            </Text>
          </View>
        )}
        {item.toolResult !== undefined && (
          <View style={styles.toolResultBox}>
            <Text style={styles.toolResultText} numberOfLines={5}>
              {typeof item.toolResult === 'string'
                ? item.toolResult
                : JSON.stringify(item.toolResult, null, 2)}
            </Text>
          </View>
        )}
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Chat header */}
      <View style={styles.chatHeader}>
        <Text style={styles.chatTitle} numberOfLines={1}>
          {sessionTitle || 'Chat'}
        </Text>
        {isGenerating && (
          <View style={styles.generatingBadge}>
            <View style={styles.generatingDot} />
            <Text style={styles.generatingText}>
              {chatState === 'thinking'
                ? 'Thinking'
                : chatState === 'streaming'
                  ? 'Writing'
                  : chatState === 'tool_executing'
                    ? 'Running tool'
                    : chatState === 'permission_pending'
                      ? 'Awaiting permission'
                      : chatState}
            </Text>
          </View>
        )}
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatText}>
              Send a message to start chatting
            </Text>
          </View>
        }
      />

      {/* Permission request overlay */}
      {pendingPermission && (
        <View style={styles.permissionOverlay}>
          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>Permission Request</Text>
            <Text style={styles.permissionTool}>
              🔧 {pendingPermission.toolName}
            </Text>
            {pendingPermission.description && (
              <Text style={styles.permissionDesc}>
                {pendingPermission.description}
              </Text>
            )}
            <View style={styles.permissionButtons}>
              <TouchableOpacity
                style={[styles.permButton, styles.denyButton]}
                onPress={() =>
                  sendPermissionResponse(pendingPermission.requestId, false, 'Denied from mobile')
                }
              >
                <Text style={styles.denyText}>Deny</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.permButton, styles.allowButton]}
                onPress={() =>
                  sendPermissionResponse(pendingPermission.requestId, true)
                }
              >
                <Text style={styles.allowText}>Allow</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        {isGenerating && (
          <TouchableOpacity style={styles.stopButton} onPress={stopGeneration}>
            <Text style={styles.stopText}>■ Stop</Text>
          </TouchableOpacity>
        )}
        <TextInput
          style={styles.textInput}
          placeholder="Message Claude..."
          placeholderTextColor="#666"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          editable={!isGenerating}
          multiline
          maxLength={4000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isGenerating) && styles.sendDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || isGenerating}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#252540',
  },
  chatTitle: {
    color: '#e0e0e0',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  generatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1b4b',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  generatingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6366f1',
    marginRight: 6,
  },
  generatingText: {
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: '500',
  },
  messageList: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
  },
  emptyChat: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyChatText: {
    color: '#555',
    fontSize: 14,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#6366f1',
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    maxWidth: '80%',
  },
  userText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 21,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    maxWidth: '90%',
    marginBottom: 8,
  },
  thinkingLabel: {
    color: '#8b5cf6',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  assistantText: {
    color: '#e0e0e0',
    fontSize: 15,
    lineHeight: 21,
    backgroundColor: '#252540',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toolHeader: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  toolName: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  toolInputBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#6366f1',
  },
  toolInputText: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  toolResultBox: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#22c55e',
  },
  toolResultText: {
    color: '#86efac',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  permissionOverlay: {
    position: 'absolute',
    bottom: 70,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  permissionCard: {
    backgroundColor: '#2d1b69',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  permissionTitle: {
    color: '#e0e0e0',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  permissionTool: {
    color: '#c4b5fd',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  permissionDesc: {
    color: '#a5b4fc',
    fontSize: 13,
    marginBottom: 12,
  },
  permissionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  permButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  denyButton: {
    backgroundColor: '#991b1b',
  },
  allowButton: {
    backgroundColor: '#166534',
  },
  denyText: {
    color: '#fca5a5',
    fontWeight: '600',
  },
  allowText: {
    color: '#86efac',
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#252540',
    gap: 8,
  },
  stopButton: {
    backgroundColor: '#991b1b',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stopText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '600',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#252540',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#e0e0e0',
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#6366f1',
    borderRadius: 20,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    opacity: 0.3,
  },
  sendIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
})
