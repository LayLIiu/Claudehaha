/**
 * Root layout — Expo Router entry
 */

import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#e0e0e0',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="home" options={{ title: 'Claude Haha', headerShown: false }} />
        <Stack.Screen name="chat" options={{ title: 'Chat', headerBackTitle: 'Back' }} />
        <Stack.Screen name="pair" options={{ title: 'Pair Device', presentation: 'modal' }} />
      </Stack>
    </>
  )
}
