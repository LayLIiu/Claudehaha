/**
 * Mobile Pairing API — 移动端配对和网络信息接口
 *
 * GET  /api/mobile/network-info  - 获取网络信息（IP、连接类型）
 * POST /api/mobile/pairing-code  - 桌面端生成配对码
 * POST /api/mobile/pair          - 移动端提交配对码，验证通过返回 H5 Token
 */

import {
  createPairingCode,
  verifyPairingCode,
  getNetworkConnectionInfo,
  createMobileToken,
  hashToken,
} from '../services/pairingService.js'
import { ManagedSettingsService } from '../services/managedSettingsService.js'
import { ProviderService } from '../services/providerService.js'
import { ApiError, errorResponse } from '../middleware/errorHandler.js'

export async function handleMobilePairApi(
  req: Request,
  _url: URL,
  segments: string[],
): Promise<Response> {
  try {
    const action = segments[2]

    // GET /api/mobile/network-info
    if (action === 'network-info' && req.method === 'GET') {
      return await handleGetNetworkInfo()
    }

    // POST /api/mobile/pairing-code
    if ((action === 'pairing-code' || action === 'pairingCode') && req.method === 'POST') {
      return await handleCreatePairingCode(req)
    }

    // POST /api/mobile/pair
    if (action === 'pair' && req.method === 'POST') {
      return await handlePair(req)
    }

    throw ApiError.notFound('Not found')
  } catch (error) {
    return errorResponse(error)
  }
}

async function handleGetNetworkInfo(): Promise<Response> {
  const serverPort = ProviderService.getServerPort()
  const info = getNetworkConnectionInfo(serverPort)
  return Response.json(info)
}

async function handleCreatePairingCode(req: Request): Promise<Response> {
  let body: { ttlHours?: number } = {}
  try {
    body = await req.json()
  } catch {}

  const state = createPairingCode(body.ttlHours || 1)
  return Response.json({
    pairingCode: state.code,
    createdAt: state.createdAt,
    expiresAt: state.expiresAt,
  })
}

/**
 * 移动端配对 — 验证配对码后自动启用 H5 访问并返回 Token
 *
 * 配对码是一次性的验证方式，验证通过后返回 H5 Token 作为持久认证凭据。
 * Token 格式与 H5 Token 完全一致（h5_<base64url>），移动端可复用
 * 同一套 H5 Token 验证中间件。
 */
async function handlePair(req: Request): Promise<Response> {
  let body: { code?: string } = {}
  try {
    body = await req.json()
  } catch {
    throw ApiError.badRequest('Invalid JSON body')
  }

  if (!body.code || !verifyPairingCode(body.code)) {
    throw ApiError.unauthorized('Invalid or expired pairing code')
  }

  // 配对码验证通过 — 确保 H5 访问已启用并返回 Token
  const managedSettingsService = new ManagedSettingsService()

  const currentSettings = await managedSettingsService.readSettings()
  const h5Access = currentSettings.h5Access

  // 如果 H5 已经启用且有 Token，复用现有 Token
  if (h5Access?.enabled && h5Access.token) {
    return Response.json({ ok: true, token: h5Access.token })
  }

  // 否则创建新 Token 并启用 H5
  const token = createMobileToken()
  const tokenHash = hashToken(token)

  const nextSettings = {
    ...h5Access,
    enabled: true,
    token,
    tokenHash,
    tokenPreview: `${token.slice(0, 7)}...${token.slice(-4)}`,
    allowedOrigins: h5Access?.allowedOrigins ?? [],
    publicBaseUrl: h5Access?.publicBaseUrl ?? null,
    fixedPort: h5Access?.fixedPort ?? null,
    disconnectGraceSeconds: h5Access?.disconnectGraceSeconds ?? null,
  }

  await managedSettingsService.updateSettings(async (current) => ({
    ...current,
    h5Access: nextSettings,
  }))

  return Response.json({ ok: true, token })
}
