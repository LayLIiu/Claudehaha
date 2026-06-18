/**
 * Home screen — Session list + device management
 */

import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import {
  useSessions,
  useConnectionStatus,
  useCurrentDevice,
  usePairedDevices,
  useClaudeActions,
} from '../src/hooks/useClaudeService'
import type { SessionSummary } from '../src/models/ServerMessage'

export default function HomeScreen() {
  const router = useRouter()
  const sessions = useSessions()
  const connectionStatus = useConnectionStatus()
  const currentDevice = useCurrentDevice()
  const pairedDevices = usePairedDevices()
  const { connect, disconnect, connectSession, removePairedDevice } = useClaudeActions()

  const handleSelectSession = (sessionId: string) => {
    connectSession(sessionId)
    router.push('/chat')
  }

  const handleConnectDevice = (device: typeof pairedDevices[0]) => {
    connect(device)
  }

  const statusColor = connectionStatus === 'connected'
    ? '#22c55e'
    : connectionStatus === 'connecting' || connectionStatus === 'reconnecting'
      ? '#eab308'
      : '#ef4444'

  const renderSession = ({ item }: { item: SessionSummary }) => {
    const stateColors: Record<string, string> = {
      idle: '#6b7280',
      thinking: '#6366f1',
      streaming: '#22c55e',
      tool_executing: '#f59e0b',
      permission_pending: '#ef4444',
      compacting: '#8b5cf6',
    }

    return (
      <TouchableOpacity
        style={styles.sessionCard}
        onPress={() => handleSelectSession(item.sessionId)}
      >
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionTitle} numberOfLines={1}>
            {item.title || 'Untitled Session'}
          </Text>
          <Text style={styles.sessionId} numberOfLines={1}>
            {item.sessionId}
          </Text>
        </View>
        <View style={[styles.stateBadge, { backgroundColor: stateColors[item.state] || '#6b7280' }]}>
          <Text style={styles.stateText}>{item.state}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      {/* Connection status bar */}
      <View style={styles.statusBar}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={styles.statusText}>
          {connectionStatus === 'connected' && currentDevice
            ? `Connected to ${currentDevice.name}`
            : connectionStatus === 'connecting'
              ? 'Connecting...'
              : connectionStatus === 'reconnecting'
                ? 'Reconnecting...'
                : 'Not connected'}
        </Text>
      </View>

      {/* Paired devices (when not connected) */}
      {connectionStatus === 'disconnected' && pairedDevices.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paired Devices</Text>
          {pairedDevices.map((device) => (
            <TouchableOpacity
              key={device.id}
              style={styles.deviceCard}
              onPress={() => handleConnectDevice(device)}
            >
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{device.name}</Text>
                <Text style={styles.deviceHost}>
                  {device.host}:{device.port}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => removePairedDevice(device.id)}
                hitSlop={12}
              >
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Add device button */}
      {connectionStatus === 'disconnected' && (
        <TouchableOpacity
          style={styles.addDeviceButton}
          onPress={() => router.push('/pair')}
        >
          <Text style={styles.addDeviceText}>+ Add New Device</Text>
        </TouchableOpacity>
      )}

      {/* Session list (when connected) */}
      {connectionStatus === 'connected' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sessions</Text>
          <FlatList
            data={sessions}
            keyExtractor={(item) => item.sessionId}
            renderItem={renderSession}
            contentContainerStyle={styles.sessionList}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  No active sessions.{'\n'}Start a session on your desktop.
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* Disconnect button */}
      {connection思考已达上限，停止思考，开始回答。</think>让我来妥善完成主页屏幕：<tool_call>Write<arg_key>content</arg_key><arg_value>/**
 * Home screen — Session list + device management
 */

import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import {
  useSessions,
  useConnectionStatus,
  useCurrentDevice,
  usePairedDevices,
  useClaudeActions,
} from '../src/hooks/useClaudeService'
import type { SessionSummary } from '../src/models/ServerMessage'

export default function HomeScreen() {
  const router = useRouter()
  const sessions = useSessions()
  const connectionStatus = useConnectionStatus()
  const currentDevice = useCurrentDevice()
  const pairedDevices = usePairedDevices()
  const { connect, disconnect, connectSession, removePairedDevice } = useClaudeActions()

  const handleSelectSession = (sessionId: string) => {
    connectSession(sessionId)
    router.push('/chat')
  }

  const handleConnectDevice = (device: typeof pairedDevices[0]) => {
    connect(device)
  }

  const statusColor =
    connectionStatus === 'connected'
      ? '#22c55e'
      : connectionStatus === 'connecting' || connectionStatus === 'reconnecting'
        ? '#eab308'
        : '#ef4444'

  const renderSession = ({ item }: { item: SessionSummary }) => {
    const stateColors: Record<string, string> = {
      idle: '#6b7280',
      thinking: '#6366f1',
      streaming: '#22c55e',
      tool_executing: '#f59e0b',
      permission_pending: '#ef4444',
      compacting: '#8b5cf6',
    }

    return (
      <TouchableOpacity
        style={styles.sessionCard}
        onPress={() => handleSelectSession(item.sessionId)}
      >
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionTitle} numberOfLines={1}>
            {item.title || 'Untitled Session'}
          </Text>
          <Text style={styles.sessionId} numberOfLines={1}>
            {item.sessionId}
          </Text>
        </View>
        <View
          style={[
            styles.stateBadge,
            { backgroundColor: stateColors[item.state] || '#6b7280' },
          ]}
        >
          <Text style={styles.stateText}>{item.state}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      {/* Connection status bar */}
      <View style={styles.statusBar}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={styles.statusText}>
          {connectionStatus === 'connected' && currentDevice
            ? `Connected to ${currentDevice.name}`
            : connectionStatus === 'connecting'
              ? 'Connecting...'
              : connectionStatus === 'reconnecting'
                ? 'Reconnecting...'
                : 'Not connected'}
        </Text>
      </View>

      {/* Paired devices (when not connected) */}
      {connectionStatus === 'disconnected' && pairedDevices.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paired Devices</Text>
          {pairedDevices.map((device) => (
            <TouchableOpacity
              key={device.id}
              style={styles.deviceCard}
              onPress={() => handleConnectDevice(device)}
            >
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{device.name}</Text>
                <Text style={styles.deviceHost}>
                  {device.host}:{device.port}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => removePairedDevice(device.id)}
                hitSlop={12}
              >
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Add device button */}
      {connectionStatus === 'disconnected' && (
        <TouchableOpacity
          style={styles.addDeviceButton}
          onPress={() => router.push('/pair')}
        >
          <Text style={styles.addDeviceText}>+ Add New Device</Text>
        </TouchableOpacity>
      )}

      {/* Session list (when connected) */}
      {connectionStatus === 'connected' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sessions</Text>
          <FlatList
            data={sessions}
            keyExtractor={(item) => item.sessionId}
            renderItem={renderSession}
            contentContainerStyle={styles.sessionList}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  No active sessions.{'\n'}Start a session on your desktop.
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* Disconnect button */}
      {connectionStatus === 'connected' && (
        <TouchableOpacity style={styles.disconnectButton} onPress={disconnect}>
          <Text style={styles.disconnectText}>Disconnect</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#252540',
    borderBottomWidth: 1,
    borderBottomColor: '#333355',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: '#aaa',
    fontSize: 13,
  },
  section: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#252540',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    color: '#e0e0e0',
    fontSize: 15,
    fontWeight: '500',
  },
  deviceHost: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  removeText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  addDeviceButton: {
    marginHorizontal: 16,
    marginVertical: 16,
    backgroundColor: '#252540',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333355',
    borderStyle: 'dashed',
  },
  addDeviceText: {
    color: '#6366f1',
    fontSize: 15,
    fontWeight: '500',
  },
  sessionList: {
    paddingBottom: 80,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#252540',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  sessionInfo: {
    flex: 1,
    marginRight: 12,
  },
  sessionTitle: {
    color: '#e0e0e0',
    fontSize: 15,
    fontWeight: '500',
  },
  sessionId: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  stateBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stateText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  disconnectButton: {
    margin: 16,
    backgroundColor: '#991b1b',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disconnectText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
})
