import { afterEach, describe, expect, it, mock } from 'bun:test'
import { WechatMediaService, collectWechatMediaCandidates } from '../media.js'
import type { AttachmentStore } from '../../common/attachment/attachment-store.js'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function mockAttachmentStore(): AttachmentStore {
  const files = new Map<string, Buffer>()
  return {
    resolvePath: (...segments: string[]) => segments.join('/'),
    write: async (path: string, data: Buffer) => {
      files.set(path, data)
      return path
    },
    read: async (path: string) => files.get(path) ?? Buffer.alloc(0),
    exists: async (path: string) => files.has(path),
    delete: async (path: string) => { files.delete(path) },
  } as unknown as AttachmentStore
}

describe('WechatMediaService', () => {
  it('downloads and decrypts an AES-encrypted image', async () => {
    // AES-128-ECB with a known key to verify decryption
    const crypto = await import('node:crypto')
    const key = crypto.randomBytes(16)
    const plaintext = Buffer.from('test-image-data')
    const cipher = crypto.createCipheriv('aes-128-ecb', key, null)
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])

    globalThis.fetch = (async () =>
      new Response(ciphertext, { status: 200 })
    ) as unknown as typeof fetch

    const store = mockAttachmentStore()
    const service = new WechatMediaService(store)

    const result = await service.downloadCandidate(
      {
        kind: 'image',
        name: 'test.jpg',
        mimeType: 'image/jpeg',
        url: 'https://cdn.example.com/encrypted-image',
        aesKey: key.toString('base64'),
      },
      'session-1',
    )

    expect(result.kind).toBe('image')
    expect(result.name).toBe('test.jpg')
    expect(result.mimeType).toBe('image/jpeg')
    expect(result.size).toBe(plaintext.length)
    expect(result.buffer).toEqual(plaintext)
  })

  it('downloads a non-encrypted file as-is', async () => {
    const fileData = Buffer.from('plain-file-content')

    globalThis.fetch = (async () =>
      new Response(fileData, { status: 200 })
    ) as unknown as typeof fetch

    const store = mockAttachmentStore()
    const service = new WechatMediaService(store)

    const result = await service.downloadCandidate(
      {
        kind: 'file',
        name: 'report.pdf',
        mimeType: 'application/pdf',
        url: 'https://cdn.example.com/file.pdf',
      },
      'session-1',
    )

    expect(result.kind).toBe('file')
    expect(result.name).toBe('report.pdf')
    expect(result.buffer).toEqual(fileData)
    expect(result.size).toBe(fileData.length)
  })

  it('throws when fetch fails', async () => {
    globalThis.fetch = (async () =>
      new Response('not found', { status: 404 })
    ) as unknown as typeof fetch

    const store = mockAttachmentStore()
    const service = new WechatMediaService(store)

    await expect(
      service.downloadCandidate(
        {
          kind: 'image',
          name: 'missing.jpg',
          url: 'https://cdn.example.com/missing',
        },
        'session-1',
      ),
    ).rejects.toThrow('WeChat media download failed: 404')
  })

  it('throws when no URL is available', async () => {
    const store = mockAttachmentStore()
    const service = new WechatMediaService(store)

    await expect(
      service.downloadCandidate(
        {
          kind: 'image',
          name: 'nourl.jpg',
        },
        'session-1',
      ),
    ).rejects.toThrow('missing a download URL')
  })
})

describe('collectWechatMediaCandidates edge cases', () => {
  it('returns empty array for undefined items', () => {
    expect(collectWechatMediaCandidates(undefined)).toEqual([])
  })

  it('returns empty array for empty items', () => {
    expect(collectWechatMediaCandidates([])).toEqual([])
  })

  it('skips items with unsupported types', () => {
    expect(collectWechatMediaCandidates([
      { type: 1, text_item: { text: 'text message' } } as any,
      { type: 99 } as any,
    ])).toEqual([])
  })

  it('uses fallback URL from image_item.url when media.full_url is absent', () => {
    const result = collectWechatMediaCandidates([
      {
        type: 2,
        msg_id: 'img-fallback',
        image_item: {
          url: 'https://fallback.example.com/image',
          media: {},
        },
      } as any,
    ])
    expect(result).toHaveLength(1)
    expect(result[0]!.url).toBe('https://fallback.example.com/image')
  })
})
