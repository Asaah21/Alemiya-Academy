// School logo: which pictures are allowed and how they are stored.
export const MAX_PICK_BYTES = 8 * 1024 * 1024 // what the person may choose (it is shrunk before upload)
export const MAX_SIDE = 512 // pixels; plenty for a report card and keeps pages light
export const LOGO_ACCEPT = '.png,.jpg,.jpeg,.webp'
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp']

export type LogoCheck = { ok: true } | { ok: false; error: string }

export function checkLogoFile(file: { type: string; size: number }): LogoCheck {
  if (file.size <= 0) return { ok: false, error: 'This file is empty.' }
  if (!ALLOWED.includes(file.type)) return { ok: false, error: 'Use a PNG or JPG picture of the school logo.' }
  if (file.size > MAX_PICK_BYTES) return { ok: false, error: 'The picture is too big. Choose one smaller than 8 MB.' }
  return { ok: true }
}

/** Size after shrinking so the longest side is at most MAX_SIDE. Never makes a picture bigger. */
export function fitSize(width: number, height: number, max: number = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export const logoPath = (now: number = Date.now()) => `logo-${now}.png`
