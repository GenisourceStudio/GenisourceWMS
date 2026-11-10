/** Named cues keep call sites readable; raw patterns remain available. */
export type HapticCue = 'success' | 'error'

const CUES: Record<HapticCue, number | number[]> = {
  success: [30, 40, 30],
  error: 80,
}

/**
 * Short haptic confirmation for the scan terminal (design-system.md §7).
 * Visual feedback always comes first; vibration is an optional extra channel,
 * guarded so desktop browsers and unsupported devices stay silent. Users can
 * disable vibration at the device / browser level.
 */
export function haptic(pattern: number | number[] | HapticCue): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(typeof pattern === 'string' ? CUES[pattern] : pattern)
  } catch {
    // Some browsers expose the API but reject calls outside a user gesture.
  }
}
