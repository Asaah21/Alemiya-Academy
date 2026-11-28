import { describe, expect, it } from 'vitest'
import { checkLogoFile, fitSize, logoPath } from './logo'

describe('school logo', () => {
  it('accepts PNG, JPG and WebP pictures', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) expect(checkLogoFile({ type, size: 1000 }).ok).toBe(true)
  })
  it('refuses other files, empty files and huge pictures in plain words', () => {
    expect(checkLogoFile({ type: 'application/pdf', size: 1000 })).toEqual({ ok: false, error: 'Use a PNG or JPG picture of the school logo.' })
    expect(checkLogoFile({ type: 'image/png', size: 0 }).ok).toBe(false)
    expect(checkLogoFile({ type: 'image/png', size: 9 * 1024 * 1024 }).ok).toBe(false)
  })
  it('shrinks big pictures and leaves small ones alone', () => {
    expect(fitSize(2048, 1024)).toEqual({ width: 512, height: 256 })
    expect(fitSize(300, 200)).toEqual({ width: 300, height: 200 })
  })
  it('makes a new file name each time', () => {
    expect(logoPath(5)).toBe('logo-5.png')
  })
})
