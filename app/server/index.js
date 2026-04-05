#!/usr/bin/env node

/**
 * agent-os — Server entry point
 *
 * This is a thin shim that launches the TypeScript server via tsx.
 * For development, use: cd app/server && npm run dev
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))

try {
  execSync(`npx tsx ${join(__dirname, 'src', 'index.ts')}`, {
    cwd: __dirname,
    stdio: 'inherit',
  })
} catch {
  console.error('Failed to start server. Run: cd app/server && npm install')
  process.exit(1)
}
