#!/usr/bin/env node

import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = resolve(__dirname, '..')
const TEMPLATE_DIR = join(ROOT_DIR, 'template')

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'domain'
}

async function copyTemplate(sourceDir, targetDir, replacements) {
  await mkdir(targetDir, { recursive: true })
  const entries = await readdir(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name)
    const targetPath = join(targetDir, entry.name)

    if (entry.isDirectory()) {
      await copyTemplate(sourcePath, targetPath, replacements)
      continue
    }

    const raw = await readFile(sourcePath, 'utf-8')
    const content = Object.entries(replacements).reduce(
      (next, [key, value]) => next.replaceAll(`{{${key}}}`, value),
      raw,
    )
    await writeFile(targetPath, content, 'utf-8')
  }
}

async function pathAvailable(pathname) {
  try {
    await stat(pathname)
    return false
  } catch {
    return true
  }
}

async function main() {
  const targetArg = process.argv[2]
  if (!targetArg) {
    console.error('Usage: create-agent-os <directory>')
    process.exit(1)
  }

  const rl = createInterface({ input, output })

  try {
    const targetDir = resolve(process.cwd(), targetArg)
    const businessName = (await rl.question('Business name: ')).trim() || 'My Business'
    const businessDescription = (await rl.question('Short description: ')).trim()
      || `${businessName} operating context.`
    const domainsAnswer = (await rl.question('Domains to initialize (comma-separated, optional): ')).trim()

    if (!(await pathAvailable(targetDir))) {
      console.error(`Target already exists: ${targetDir}`)
      process.exit(1)
    }

    await copyTemplate(TEMPLATE_DIR, targetDir, {
      BUSINESS_NAME: businessName,
      BUSINESS_DESCRIPTION: businessDescription,
    })

    const domains = domainsAnswer
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)

    for (const domain of domains) {
      const id = slugify(domain)
      const domainDir = join(targetDir, 'context', id)
      await mkdir(domainDir, { recursive: true })
      await writeFile(join(domainDir, 'README.md'), `# ${domain}\n\nContext source placeholder for ${domain}.\n`, 'utf-8')
      await writeFile(
        join(domainDir, 'source.yml'),
        [
          `id: ${id}`,
          `name: ${domain}`,
          'type: folder',
          'status: draft',
          `path: context/${id}`,
          `description: ${domain} context source.`,
          '',
        ].join('\n'),
        'utf-8',
      )
    }

    console.log(`Created agent-os instance at ${targetDir}`)
  } finally {
    rl.close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
