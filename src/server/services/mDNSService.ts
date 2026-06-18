/**
 * mDNS Service — 通过 Bonjour 广播桌面端服务
 *
 * 让局域网内的手机 App 自动发现桌面端服务器
 * 服务类型: _cc-haha._tcp
 */

import Bonjour from 'bonjour-service'

class MDNSService {
  private service: Bonjour.Service | null = null
  private started = false
  private port = 3456
  private name = ''

  start(port?: number, serverName?: string): void {
    if (this.started) return
    this.started = true

    this.port = port ?? this.port
    this.name = serverName ?? `cc-haha-${Math.random().toString(36).substring(2, 6)}`

    try {
      const bonjour = new Bonjour()

      this.service = bonjour.publish({
        name: this.name,
        type: 'cc-haha',
        port: this.port,
        protocol: 'tcp',
      })

      this.service.on('up', () => {
        console.log(`[mDNS] Advertising: ${this.name} on port ${this.port}`)
      })

      this.service.on('error', (err: Error) => {
        console.error(`[mDNS] Error: ${err.message}`)
      })

      console.log(`[mDNS] Service started: ${this.name} @ port ${this.port}`)
    } catch (err) {
      console.error(`[mDNS] Failed to start: ${err}`)
      this.started = false
    }
  }

  stop(): void {
    if (!this.started) return
    this.started = false

    try {
      if (this.service) {
        this.service.stop()
        this.service = null
      }
    } catch (err) {
      console.error(`[mDNS] Stop error: ${err}`)
    }

    console.log('[mDNS] Service stopped')
  }

  isActive(): boolean {
    return this.started
  }

  getInfo(): { name: string; port: number; active: boolean } {
    return { name: this.name, port: this.port, active: this.started }
  }
}

export const mDNSService = new MDNSService()
