/**
 * Pair screen — Enter pairing code or scan QR to pair with desktop
 */

import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useClaudeActions, usePairedDevices } from '../src/hooks/useClaudeService'

export default function PairScreen() {
  const router = useRouter()
  const { pairWithCode } = useClaudeActions()
  const devices = usePairedDevices()

  const [host, setHost] = useState('')
  const [port, setPort] = useState('3456')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handlePair = async () => {
    if (!host.trim()) {
      Alert.alert('Missing Host', 'Enter the desktop IP address (shown on desktop pairing screen)')
      return
    }
    if (!code.trim()) {
      Alert.alert('Missing Code', 'Enter the 6-character pairing code from the desktop app')
      return
    }

    setLoading(true)
    const result = await pairWithCode(host.trim(), parseInt(port, 10) || 3456, code.trim())
    setLoading(false)

    if (result.ok) {
      Alert.alert('Paired!', 'Successfully connected to Claude desktop', [
        { text: 'Continue', onPress: () => router.replace('/home') },
      ])
    } else {
      Alert.alert('Pairing Failed', result.error || 'Unknown error')
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Claude Haha</Text>
        <Text style={styles.subtitle}>Pair with your desktop</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Desktop IP Address</Text>
          <TextInput
            style={styles.input}
            placeholder="192.168.1.x"
            placeholderTextColor="#666"
            value={host}
            onChangeText={setHost}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Port</Text>
          <TextInput
            style={styles.input}
            placeholder="3456"
            placeholderTextColor="#666"
            value={port}
            onChangeText={setPort}
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Pairing Code</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="ABCDEF"
            placeholderTextColor="#666"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handlePair}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Pairing...' : 'Pair'}
          </Text>
        </TouchableOpacity>

        {devices.length > 0 && (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => router.replace('/home')}
          >
            <Text style={styles.skipText}>Use existing device →</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#e0e0e0',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#252540',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#e0e0e0',
  },
  codeInput: {
    letterSpacing: 4,
    fontSize: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  skipText: {
    color: '#6366f1',
    fontSize: 14,
  },
})
