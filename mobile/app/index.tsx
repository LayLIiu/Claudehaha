/**
 * Index screen — Splash / auto-navigate based on paired devices
 */

import { Redirect } from 'expo-router'
import { usePairedDevices } from '../src/hooks/useClaudeService'
import { View, ActivityIndicator, StyleSheet } from 'react-native'

export default function IndexScreen() {
  const devices = usePairedDevices()

  // If user has paired devices, go to home. Otherwise go to pairing.
  if (devices.length > 0) {
    return <Redirect href="/home" />
  }
  return <Redirect href="/pair" />
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
})
