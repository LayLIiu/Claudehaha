/**
 * 配对服务 — 移动端配对码生成/验证 + 网络信息检测
 *
 * 配对码是一次性验证码，验证通过后返回 H5 Token 作为持久认证。
 * 配对码持久化到 ~/.claude/adapters.json。
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { randomBytes, createHash } from 'node:crypto'

export type PairingCodeState = {
  code: string
  createdAt: number
  expiresAt: number
}

type AdapterConfig = {
  pairing?: PairingCodeState | Record<string, unknown>
  [key: string]: unknown
}

// ─── 配对码字符集（排除易混淆字符 0/O/1/I） ──────────────────────────────────
const PAIRING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const PAIRING_CODE_LENGTH = 6
const DEFAULT_TTL_HOURS = 1

// ─── 文件读写 ──────────────────────────────────────────────────────────────────

function getConfigPath(): string {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
  return path.join(configDir, 'adapters.json')
}

function readConfigFile(): AdapterConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf-8')
    return JSON.parse(raw) as AdapterConfig
  } catch {
    return {}
  }
}

function writeConfigFileSync(data: AdapterConfig): void {
  const filePath = getConfigPath()
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  const tmp = `${filePath}.tmp.${Date.now()}`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  fs.renameSync(tmp, filePath)
}

// ─── 配对码 ────────────────────────────────────────────────────────────────────

function readPairingState(): PairingCodeState | null {
  const pairing = readConfigFile().pairing as PairingCodeState | undefined
  if (!pairing || typeof pairing.code !== 'string') return null
  if (typeof pairing.expiresAt !== 'number' || pairing.expiresAt <= Date.now()) return null
  return pairing
}

export function createPairingCode(ttlHours = DEFAULT_TTL_HOURS): PairingCodeState {
  let code = ''
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
    code += PAIRING_ALPHABET[Math.floor(Math.random() * PAIRING_ALPHABET.length)]
  }

  const now = Date.now()
  const state: PairingCodeState = {
    code,
    createdAt: now,
    expiresAt: now + Math.max(1, ttlHours) * 60 * 60 * 1000,
  }

  const config = readConfigFile()
  config.pairing = state
  writeConfigFileSync(config)
  return state
}

export function verifyPairingCode(code: string): boolean {
  const state = readPairingState()
  if (!state) return false
  return state.code.toUpperCase() === code.trim().toUpperCase()
}

// ─── 网络信息 ──────────────────────────────────────────────────────────────────

export function getLocalIpAddress(): string | null {
  const interfaces = os.networkInterfaces()

  // 优先 en/eth 接口
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue
    if (!/^en\d+$/i.test(name) && !/^eth\d+$/i.test(name)) continue
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        if (addr.address.startsWith('192.168.') || addr.address.startsWith('10.')) {
          return addr.address
        }
      }
    }
  }

  // 回退：任意非内环接口
  for (const [, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        if (addr.address.startsWith('192.168.') || addr.address.startsWith('10.')) {
          return addr.address
        }
      }
    }
  }

  // 最后回退：任何非 link-local 的 IPv4
  for (const [, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.')) {
        return addr.address
      }
    }
  }

  return null
}

export type ConnectionType = 'lan' | 'tailscale' | 'tunnel' | 'none'

export type NetworkConnectionInfo = {
  recommendedType: ConnectionType
  lanUrl: string | null
  tunnelUrl: string | null
  serverPort: number
}

export function getNetworkConnectionInfo(serverPort: number): NetworkConnectionInfo {
  const localIp = getLocalIpAddress()
  const lanUrl = localIp ? `${localIp}:${serverPort}` : null

  let recommendedType: ConnectionType = 'none'
  if (lanUrl) {
    recommendedType = 'lan'
  }

  return { recommendedType, lanUrl, tunnelUrl: null, serverPort }
}

// ─── 移动端 Token（复用 H5 Token 格式） ────────────────────────────────────────

export function createMobileToken(): string {
  return `h5_${randomBytes(32).toString('base64url')}`
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export { getConfigPath }
