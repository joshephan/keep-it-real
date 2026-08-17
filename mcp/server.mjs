#!/usr/bin/env node
import fs from 'node:fs/promises'
import { readStore, storePath, writeStore } from './store.mjs'
import { callTool, ToolError, TOOLS } from './tools.mjs'

/**
 * A Model Context Protocol server over stdio, spoken by hand: MCP is JSON-RPC 2.0
 * with one message per line, which is little enough that this app keeps its
 * dependency list empty rather than pulling an SDK into a local-only planner.
 *
 * stdout carries protocol messages and nothing else — every diagnostic goes to
 * stderr, where the host shows it as server log output.
 */

const pkg = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'))

const SERVER_INFO = { name: 'keep-it-real', title: pkg.productName, version: pkg.version }
const DEFAULT_PROTOCOL_VERSION = '2025-06-18'
const KNOWN_PROTOCOL_VERSIONS = ['2024-11-05', '2025-03-26', '2025-06-18']

const INSTRUCTIONS = [
  'Keep It Real is a local desktop planner with two tracks on one timeline:',
  '"plan" is what the user intended to do, "actual" is what happened.',
  'Finishing a plan means promoting it (promote_plan), which copies it onto the',
  'actual track with the real dates and leaves the plan untouched, so the drift',
  'between intention and reality stays visible. Everything lives in one local',
  `JSON file (${storePath()}); there is no account and no server.`,
].join(' ')

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function respond(id, result) {
  send({ jsonrpc: '2.0', id, result })
}

function respondError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } })
}

function textResult(payload, isError = false) {
  return {
    content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2) }],
    isError,
  }
}

async function runTool(params) {
  const name = params?.name
  if (typeof name !== 'string') return textResult('Error: tools/call needs a tool name', true)

  try {
    const store = await readStore()
    const { store: next, result } = callTool(store, name, params.arguments)
    if (next) await writeStore(next)
    return textResult(result)
  } catch (err) {
    if (err instanceof ToolError) return textResult(`Error: ${err.message}`, true)
    if (err instanceof SyntaxError) {
      return textResult(
        `Error: the store file at ${storePath()} is not valid JSON. Open the app once — it moves a broken file aside and starts clean.`,
        true,
      )
    }
    console.error('[keep-it-real mcp] tool failed:', err)
    return textResult(`Error: ${err.message}`, true)
  }
}

async function handle(message) {
  const { id, method, params } = message
  // Responses to requests we never send, and anything without a method, are not
  // ours to answer.
  if (typeof method !== 'string') return
  const isNotification = id === undefined || id === null

  switch (method) {
    case 'initialize': {
      const asked = params?.protocolVersion
      respond(id, {
        protocolVersion: KNOWN_PROTOCOL_VERSIONS.includes(asked) ? asked : DEFAULT_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      })
      return
    }
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return
    case 'ping':
      respond(id, {})
      return
    case 'tools/list':
      respond(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      })
      return
    case 'tools/call':
      respond(id, await runTool(params))
      return
    default:
      if (!isNotification) respondError(id, -32601, `method not found: ${method}`)
  }
}

// Requests are handled strictly in order: each tool call is a read-modify-write
// of one file, so two of them must never be in flight at the same time.
let chain = Promise.resolve()

function enqueue(line) {
  let message
  try {
    message = JSON.parse(line)
  } catch {
    send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } })
    return
  }
  if (!message || typeof message !== 'object') return
  chain = chain
    .then(() => handle(message))
    .catch((err) => {
      console.error('[keep-it-real mcp] handler failed:', err)
      if (message.id !== undefined && message.id !== null) {
        respondError(message.id, -32603, `internal error: ${err.message}`)
      }
    })
}

let buffer = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  buffer += chunk
  let cut = buffer.indexOf('\n')
  while (cut !== -1) {
    const line = buffer.slice(0, cut).trim()
    buffer = buffer.slice(cut + 1)
    if (line) enqueue(line)
    cut = buffer.indexOf('\n')
  }
})
process.stdin.on('end', () => process.exit(0))
process.stdout.on('error', () => process.exit(0)) // host went away mid-write
