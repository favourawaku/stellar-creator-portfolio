import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Types (mirrored from the parent messages route)
// ---------------------------------------------------------------------------

type Attachment = {
  name: string
  type: string
  size: number
  data: string
}

type MessagePayload = {
  id: string
  threadId: string
  senderId: string
  recipientId: string
  ciphertext: string
  iv: string
  createdAt: string
  attachment?: Attachment | null
  status?: 'sent' | 'delivered' | 'read'
  readBy?: string[]
  metadata?: Record<string, unknown>
}

type ServerState = {
  clients: Set<WebSocket>
  history: MessagePayload[]
}

// ---------------------------------------------------------------------------
// Search-specific result types
// ---------------------------------------------------------------------------

export type SearchHit = {
  messageId: string
  threadId: string
  senderId: string
  createdAt: string
  snippet: string          // plain-text excerpt with matched terms wrapped in <mark>
  attachmentMatch: boolean // true when the match was in the attachment name/type
}

export type GroupedResult = {
  threadId: string
  matchCount: number
  hits: SearchHit[]
}

export type SearchResponse = {
  results: GroupedResult[]
  total: number
  query: string
  latencyMs: number
}

// ---------------------------------------------------------------------------
// Shared state accessor (same pattern as parent route)
// ---------------------------------------------------------------------------

const getState = (): ServerState => {
  const g = globalThis as unknown as { __messageState?: ServerState }
  if (!g.__messageState) {
    g.__messageState = { clients: new Set<WebSocket>(), history: [] }
  }
  return g.__messageState
}

// ---------------------------------------------------------------------------
// Full-text search helpers
// ---------------------------------------------------------------------------

/**
 * Tokenise a query string into lowercase terms, deduped and non-empty.
 * Multi-word queries are AND-matched (all terms must appear in the text).
 */
function tokenise(q: string): string[] {
  return [...new Set(
    q.toLowerCase()
      .split(/\s+/)
      .map(t => t.replace(/[^a-z0-9_@.-]/g, ''))
      .filter(Boolean)
  )]
}

/**
 * Returns true if every term appears somewhere in `text`.
 */
function allTermsMatch(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase()
  return terms.every(t => lower.includes(t))
}

/**
 * Wrap every occurrence of each term in `text` with <mark>…</mark>.
 * Case-insensitive; preserves original casing of the matched text.
 */
function highlight(text: string, terms: string[]): string {
  if (!terms.length || !text) return text
  // Build a single alternation pattern, longest first to avoid partial matches
  const pattern = terms
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  return text.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>')
}

/**
 * Extract a short snippet (≤ 160 chars) centred on the first match.
 * If no match is found, returns the first 160 chars of the text.
 */
function excerpt(text: string, terms: string[], maxLen = 160): string {
  if (!text) return ''
  const lower = text.toLowerCase()
  let firstIdx = text.length
  for (const t of terms) {
    const idx = lower.indexOf(t)
    if (idx !== -1 && idx < firstIdx) firstIdx = idx
  }
  const start = Math.max(0, firstIdx - 40)
  const raw = text.slice(start, start + maxLen)
  const trimmed = start > 0 ? `…${raw}` : raw
  return highlight(trimmed, terms)
}

/**
 * Collect every searchable text surface of a message into one string.
 * We search:
 *   1. metadata.plainText   — decrypted body stored server-side by the sender
 *   2. attachment.name      — file name
 *   3. attachment.type      — MIME type
 *   4. senderId / recipientId — so users can search by address
 */
function searchableText(msg: MessagePayload): { body: string; attachmentText: string } {
  const body = [
    (msg.metadata?.plainText as string | undefined) ?? '',
    msg.senderId,
    msg.recipientId,
  ].join(' ')

  const attachmentText = msg.attachment
    ? `${msg.attachment.name} ${msg.attachment.type}`
    : ''

  return { body, attachmentText }
}

// ---------------------------------------------------------------------------
// GET /api/messages/search
//
// Query params:
//   q             — required; space-separated search terms (AND semantics)
//   conversationId — optional; restrict search to a single threadId
//
// Response: SearchResponse (see type above)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const t0 = Date.now()
  const { searchParams } = new URL(request.url)

  const rawQ = searchParams.get('q')?.trim() ?? ''
  const conversationId = searchParams.get('conversationId') ?? undefined

  if (!rawQ) {
    return NextResponse.json(
      { error: 'Missing required query parameter: q' },
      { status: 400 }
    )
  }

  const terms = tokenise(rawQ)
  if (!terms.length) {
    return NextResponse.json(
      { error: 'Query contains no searchable terms after normalisation' },
      { status: 400 }
    )
  }

  const { history } = getState()

  // Optional thread filter
  const pool = conversationId
    ? history.filter(m => m.threadId === conversationId)
    : history

  // Score and collect hits
  const hits: SearchHit[] = []

  for (const msg of pool) {
    const { body, attachmentText } = searchableText(msg)
    const bodyMatch = body && allTermsMatch(body, terms)
    const attachMatch = attachmentText ? allTermsMatch(attachmentText, terms) : false

    if (!bodyMatch && !attachMatch) continue

    const snippetSource = bodyMatch ? body : attachmentText
    hits.push({
      messageId: msg.id,
      threadId: msg.threadId,
      senderId: msg.senderId,
      createdAt: msg.createdAt,
      snippet: excerpt(snippetSource, terms),
      attachmentMatch: !bodyMatch && attachMatch,
    })
  }

  // Sort by date descending
  hits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Group by thread
  const byThread = new Map<string, SearchHit[]>()
  for (const hit of hits) {
    const arr = byThread.get(hit.threadId) ?? []
    arr.push(hit)
    byThread.set(hit.threadId, arr)
  }

  const results: GroupedResult[] = Array.from(byThread.entries()).map(([threadId, threadHits]) => ({
    threadId,
    matchCount: threadHits.length,
    hits: threadHits,
  }))

  const response: SearchResponse = {
    results,
    total: hits.length,
    query: rawQ,
    latencyMs: Date.now() - t0,
  }

  return NextResponse.json(response)
}

export const dynamic = 'force-dynamic'
export const runtime = 'edge'
