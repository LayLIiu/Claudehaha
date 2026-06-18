/**
 * Push notification service
 *
 * Handles registering for push notifications and sending
 * push tokens to the desktop server for delivery.
 */

import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { MMKV } from 'react-native-mmkv'

const storage = new MMKV({ id: 'claude-haha-mobile' })

// Configure notification handler for foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

class PushService {
  private _expoPushToken: string | null = null

  get pushToken(): string | null {
    return this._expoPushToken
  }

  async register(): Promise<string | null> {
    if (Platform.OS === 'web') return null

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      let finalStatus = existingStatus

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }

      if (finalStatus !== 'granted') {
        console.log('[Push] Permission not granted')
        return null
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'your-expo-project-id',
      })

      this._expoPushToken = token.data
      storage.set('push_token', token.data)
      console.log('[Push] Token:', token.data)

      return token.data
    } catch (err) {
      console.error('[Push] Registration failed:', err)
      return null
    }
  }

  /**
   * Register push token with the desktop server so it can send
   * notifications when session events occur.
   */
  async registerWithServer(serverUrl: string, h5Token: string): Promise<void> {
    if (!this._expoPushToken) return

    try {
      await fetch(`${serverUrl}/api/mobile/push-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${h5Token}`,
        },
        body: JSON.stringify({ token: this._expoPushToken, platform: Platform.OS }),
      })
    } catch (err) {
      console.error('[Push] Failed to register with server:', err)
    }
  }

  /**
   * Listen for incoming notifications while app is in foreground.
   */
  addNotificationListener(
    callback: (notification: Notifications.Notification) => void,
  ): () => void {
    const subscription = Notifications.addNotificationReceivedListener(callback)
    return () => subscription.remove()
  }

  /**
   * Listen for notification responses (user tapped notification).
   */
  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void,
  ): () => void {
    const subscription = Notifications.addNotificationResponseReceivedListener(callback)
    return () => subscription.remove()
  }
}

export const pushService = new PushService()
