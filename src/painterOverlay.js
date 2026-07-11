export function ensurePainterOverlay(rootId) {
  // Creates an overlay inside #root that sits above bpmn-js palette.
  // Called once on mount.
  let overlay = document.getElementById(rootId)
  if (overlay) return overlay

  overlay = document.createElement('div')
  overlay.id = rootId
  overlay.className = 'bpm-painter-overlay'
  overlay.style.display = 'none'


  overlay.innerHTML = `
    <div style="font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-muted); margin-bottom: 8px;">
      Painter
    </div>
    <label style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
      <input id="painterModeToggle" type="checkbox" style="transform: scale(1.1)" />
      <span style="font-size: 12.5px; color: var(--ink);">Enable</span>
    </label>
    <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
      <input id="painterColorPicker" type="color" value="#ff4d4f" style="width:34px; height:26px; padding:0; border:none; background:transparent;" />
      <span id="painterColorLabel" style="font-family: var(--font-mono); font-size: 11.5px; color: var(--ink-muted);">#ff4d4f</span>
    </div>
    <div style="font-size: 12px; color: var(--ink-muted); line-height:1.35; margin-bottom:8px;">
      Click a Task/Event/Lane to fill.
    </div>
    <button id="painterClearBtn" type="button" style="width:100%; padding:6px 10px; border-radius: 6px; border: 1px solid var(--border); background: transparent; cursor:pointer; color: var(--ink); font-weight:600;">
      Clear coloring
    </button>
  `

  document.body.appendChild(overlay)
  return overlay
}

export function positionPainterOverlay(overlayEl, paletteEl) {
  if (!overlayEl || !paletteEl) return

  const paletteRect = paletteEl.getBoundingClientRect()
  // Prefer placing the overlay beside the palette (not on top of it).
  // If there's room on the left of the palette, place it there; otherwise place to the right.
  const margin = 8
  // Try to read the overlay width; fall back to a sensible default.
  const overlayWidth = overlayEl.offsetWidth || 140
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth

  let left
  // If palette is close to the left edge, place overlay to the right of palette
  if (paletteRect.left < overlayWidth + margin) {
    left = Math.min(viewportWidth - overlayWidth - margin, paletteRect.right + margin)
  } else {
    // Place overlay to the left of palette
    left = Math.max(margin, paletteRect.left - overlayWidth - margin)
  }

  // Keep top aligned but ensure it stays in the viewport vertically
  const overlayHeight = overlayEl.offsetHeight || 120
  let top = paletteRect.top + margin
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight
  if (top + overlayHeight + margin > viewportHeight) {
    top = Math.max(margin, viewportHeight - overlayHeight - margin)
  }

  overlayEl.style.left = `${Math.round(left)}px`
  overlayEl.style.top = `${Math.round(top)}px`
}

