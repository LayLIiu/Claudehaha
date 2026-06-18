/**
 * Device and pairing models
 */

export type PairedDevice = {
  id: string
  name: string
  host: string
  port: number
  token: string
  pairedAt: number
  lastConnectedAt?: number
}

export type DiscoveredDevice = {
  name: string
  host: string
  port: number
}

export type PairingResult = {
  ok: boolean
  token?: string
  error?: string
}

export type NetworkConnectionInfo = {
  recommendedType: 'lan' | 'tailscale' | 'tunnel' | 'none'
  lanUrl: string | null
  tunnelUrl: string | null
  serverPort: number
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
