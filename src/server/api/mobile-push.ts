/**
 * Mobile Push Token API
 *
 * POST /api/mobile/push-token - Register push notification token
 */

import { ApiError, errorResponse } from '../middleware/errorHandler.js'

type PushTokenRegistration = {
  token: string
  platform: 'ios' | 'android' | 'web'
}

// In-memory store for push tokens. In production this should be persisted.
const pushTokens = new Map<string, PushTokenRegistration>()

export async function handleMobilePushApi(
  req: Request,
  _url: URL,
  segments: string[],
): Promise<Response> {
  try {
    const action = segments[2]

    // POST /api/mobile/push-token
    if (action === 'push-token' && req.method === 'POST') {
      return await handleRegisterPushToken(req)
    }

    throw ApiError.notFound('Not found')
  } catch (error) {
    return errorResponse(error)
  }
}

async function handleRegisterPushToken(req: Request): Promise<Response> {
  let body: Partial<PushTokenRegistration> = {}
  try {
    body = await req.json()
  } catch {
    throw ApiError.badRequest('Invalid JSON body')
  }

  if (!body.token || typeof body.token !== 'string') {
    throw ApiError.badRequest('Missing push token')
  }

  const registration: PushTokenRegistration = {
    token: body.token,
    platform: body.platform || 'ios',
  }

  pushTokens.set(body.token, registration)
  console.log(`[Push] Registered ${registration.platform} push token: ${body.token.slice(0, 20)}...`)

  return Response.json({ ok: true })
}

/**
 * Get all registered push tokens (for use by notification dispatchers).
 */
export function getRegisteredPushTokens(): PushTokenRegistration[] {
  return Array.from(pushTokens.values())
}
