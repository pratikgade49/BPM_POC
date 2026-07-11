export function hexToRgb(hex) {
  const cleaned = String(hex || '').replace('#', '').trim()
  if (![3, 6].includes(cleaned.length)) return null
  const full = cleaned.length === 3 ? cleaned.split('').map((c) => c + c).join('') : cleaned
  const num = parseInt(full, 16)
  if (Number.isNaN(num)) return null
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  }
}

export function rgbToHex(r, g, b) {
  const to = (n) => {
    const v = Math.max(0, Math.min(255, Math.round(n)))
    return v.toString(16).padStart(2, '0')
  }
  return `#${to(r)}${to(g)}${to(b)}`
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}

export function mixHex(a, b, t) {
  const ra = hexToRgb(a)
  const rb = hexToRgb(b)
  if (!ra || !rb) return a
  return rgbToHex(lerp(ra.r, rb.r, t), lerp(ra.g, rb.g, t), lerp(ra.b, rb.b, t))
}

export function normalize01(value, min, max) {
  if (max === min) return 0
  return (value - min) / (max - min)
}

export function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}

export function buildHeatColor(value, min, max, opts = {}) {
  const {
    low = '#d1d5db', // gray
    high = '#ef4444', // red
  } = opts
  const t = clamp01(normalize01(value, min, max))
  return mixHex(low, high, t)
}

