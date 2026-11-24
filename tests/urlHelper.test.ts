import { describe, it, expect } from 'vitest'
import {
  extractSiteTitle,
  getFaviconUrl,
  isDirectUrl,
  isPrivateNetwork,
  normalizeUrl,
  toDirectUrl
} from '../src/utils/urlHelper'

describe('urlHelper', () => {
  it('identifies direct URLs vs search phrases', () => {
    expect(isDirectUrl('github.com')).toBe(true)
    expect(isDirectUrl('https://vuejs.org/guide')).toBe(true)
    expect(isDirectUrl('localhost:5188')).toBe(true)
    expect(isDirectUrl('192.168.1.100:8080')).toBe(true)

    expect(isDirectUrl('vue tutorial')).toBe(false)
    expect(isDirectUrl('g vue')).toBe(false)
    expect(isDirectUrl('bilibili')).toBe(false)
  })

  it('adds proper protocol in toDirectUrl and normalizeUrl', () => {
    expect(toDirectUrl('localhost:3000')).toBe('http://localhost:3000')
    expect(toDirectUrl('192.168.1.1')).toBe('http://192.168.1.1')
    expect(toDirectUrl('github.com')).toBe('https://github.com')
    expect(normalizeUrl('example.com')).toBe('https://example.com')
  })

  it('protects private network hosts from external favicon lookups', () => {
    expect(isPrivateNetwork('localhost')).toBe(true)
    expect(isPrivateNetwork('nas.local')).toBe(true)
    expect(isPrivateNetwork('192.168.1.100')).toBe(true)
    expect(isPrivateNetwork('172.16.0.1')).toBe(true)
    expect(isPrivateNetwork('172.32.0.1')).toBe(false)
    expect(isPrivateNetwork('github.com')).toBe(false)

    expect(getFaviconUrl('http://192.168.1.100:9999', 'UnknownService')).toBe('http://192.168.1.100:9999/favicon.ico')
    expect(getFaviconUrl('https://example.com', 'Example')).toBe('https://icon.horse/icon/example.com')
    expect(getFaviconUrl('http://192.168.1.100:8096', 'Emby')).toContain('dashboard-icons/png/emby.png')
  })

  it('extracts friendly site titles from known and generic domains', () => {
    expect(extractSiteTitle('https://www.bilibili.com/video/BV1')).toBe('哔哩哔哩')
    expect(extractSiteTitle('https://docs.example.com')).toBe('Example')
  })
})
