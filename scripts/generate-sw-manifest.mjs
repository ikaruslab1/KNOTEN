import { readdirSync, existsSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')
const NEXT_STATIC = join(ROOT, '.next', 'static')
const OUT_FILE = join(ROOT, 'public', 'sw-cache-manifest.json')

/**
 * Collect all JS/CSS/font URLs from .next/static/
 * These will be precached by the Service Worker on install.
 */
function collectFiles(baseDir, currentDir, out) {
  try {
    const entries = readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        collectFiles(baseDir, fullPath, out)
      } else if (entry.isFile()) {
        const ext = entry.name.split('.').pop() || ''
        if (['js', 'css', 'woff2', 'woff', 'ttf'].includes(ext)) {
          const relative = fullPath
            .replace(baseDir, '')
            .replace(/\\/g, '/')
          out.push(`/_next/static${relative}`)
        }
      }
    }
  } catch {
    // Ignore unreadable directories
  }
}

if (!existsSync(NEXT_STATIC)) {
  console.warn('[sw-manifest] .next/static not found, skipping manifest generation.')
  process.exit(0)
}

const assets = []
collectFiles(NEXT_STATIC, NEXT_STATIC, assets)

const manifest = {
  version: Date.now(),
  assets,
  shells: ['/', '/manifest.json', '/offline.html', '/icon-192.png', '/icon-512.png'],
}

writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2), 'utf-8')
console.log(`[sw-manifest] Generated ${OUT_FILE} with ${assets.length} assets.`)
