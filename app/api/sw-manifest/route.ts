import { NextResponse } from 'next/server'
import { readdirSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * GET /api/sw-manifest
 * Returns all /_next/static/ asset URLs for the Service Worker to precache.
 */
export async function GET() {
  const urls: string[] = []

  try {
    const staticDir = join(process.cwd(), '.next', 'static')
    if (existsSync(staticDir)) {
      collectFiles(staticDir, staticDir, urls)
    }
  } catch (err) {
    console.warn('[sw-manifest] Could not read .next/static:', err)
  }

  const shellUrls = ['/', '/manifest.json', '/offline.html', '/icon-192.png', '/icon-512.png']

  return NextResponse.json(
    { assets: urls, shells: shellUrls },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

function collectFiles(baseDir: string, currentDir: string, out: string[]) {
  try {
    const entries = readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        collectFiles(baseDir, fullPath, out)
      } else if (entry.isFile()) {
        const ext = entry.name.split('.').pop() || ''
        if (['js', 'css', 'woff2', 'woff', 'ttf'].includes(ext)) {
          const relative = fullPath.replace(baseDir, '').replace(/\\/g, '/')
          out.push(`/_next/static${relative}`)
        }
      }
    }
  } catch {
    // Ignore unreadable directories
  }
}
