import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildStandardFaviconCandidates,
  extractFaviconCandidatesFromHtml,
  resolveSiteFavicon
} from '../src/services/faviconFetcher'

describe('faviconFetcher', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('builds subpath and root standard favicon candidates covering svg, png, ico, and apple-touch-icon', () => {
    const rootCandidates = buildStandardFaviconCandidates('http://192.168.1.100:8080/')
    expect(rootCandidates).toEqual([
      'http://192.168.1.100:8080/favicon.svg',
      'http://192.168.1.100:8080/favicon.png',
      'http://192.168.1.100:8080/favicon.ico',
      'http://192.168.1.100:8080/apple-touch-icon.png',
      'http://192.168.1.100:8080/apple-touch-icon-precomposed.png'
    ])

    const subpathCandidates = buildStandardFaviconCandidates('http://192.168.1.100:8080/rssui')
    expect(subpathCandidates.slice(0, 3)).toEqual([
      'http://192.168.1.100:8080/rssui/favicon.svg',
      'http://192.168.1.100:8080/rssui/favicon.png',
      'http://192.168.1.100:8080/rssui/favicon.ico'
    ])
  })

  it('extracts and prioritizes svg/png link icons from HTML', () => {
    const html = `
      <!doctype html>
      <html>
        <head>
          <link rel="shortcut icon" href="/old.ico" />
          <link rel="icon" type="image/svg+xml" href="/assets/logo.svg" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        </head>
      </html>
    `
    const urls = extractFaviconCandidatesFromHtml(html, 'http://192.168.1.100:9000/app')
    expect(urls).toEqual([
      'http://192.168.1.100:9000/assets/logo.svg',
      'http://192.168.1.100:9000/apple-touch-icon.png',
      'http://192.168.1.100:9000/old.ico'
    ])
  })

  it('resolves a LAN site icon declared in HTML even when /favicon.ico is missing', async () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="10"/></svg>'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url === 'http://192.168.1.100:8123/') {
          return new Response(
            '<html><head><link rel="icon" type="image/svg+xml" href="/static/rssui.svg"></head></html>',
            { status: 200, headers: { 'content-type': 'text/html' } }
          )
        }
        if (url === 'http://192.168.1.100:8123/static/rssui.svg') {
          return new Response(svgContent, {
            status: 200,
            headers: { 'content-type': 'image/svg+xml' }
          })
        }
        return new Response('Not Found', { status: 404 })
      })
    )

    const resolved = await resolveSiteFavicon('http://192.168.1.100:8123/', 'rssui')
    expect(resolved).toContain('data:image/svg+xml')
  })
})
