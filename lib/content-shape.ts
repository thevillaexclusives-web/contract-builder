import type { JSONContent } from '@tiptap/core'

/**
 * Wrapper shape for persisted content: { body, header, footer }.
 * Backward compatible: if raw content has type==='doc', it's treated as body-only.
 */
export interface ContentEnvelope {
  body: JSONContent
  header: JSONContent
  footer: JSONContent
}

const emptyDoc: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

/** Parse DB content field into body/header/footer. */
export function parseContent(raw: unknown): ContentEnvelope {
  if (!raw || typeof raw !== 'object') {
    return { body: emptyDoc, header: emptyDoc, footer: emptyDoc }
  }

  const obj = raw as Record<string, unknown>

  // Legacy shape: raw is a TipTap doc directly
  if (obj.type === 'doc') {
    return { body: raw as JSONContent, header: emptyDoc, footer: emptyDoc }
  }

  // New shape: { body, header?, footer? }
  return {
    body: (obj.body as JSONContent) || emptyDoc,
    header: (obj.header as JSONContent) || emptyDoc,
    footer: (obj.footer as JSONContent) || emptyDoc,
  }
}

/** Serialize body/header/footer into the shape stored in DB. */
export function serializeContent(
  body: JSONContent | undefined,
  header: JSONContent | undefined,
  footer: JSONContent | undefined
): ContentEnvelope {
  return {
    body: body || emptyDoc,
    header: header || emptyDoc,
    footer: footer || emptyDoc,
  }
}
