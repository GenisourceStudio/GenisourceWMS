interface BrandMarkProps {
  size?: number
  /** "dark" sits on the navy rail; "light" inverts for white surfaces. */
  tone?: 'dark' | 'light'
}

/**
 * The ripple motif: concentric elliptical rings, the one graphic element the
 * brand allows. A screen shows at most one, partially cropped.
 */
export function BrandMark({ size = 28, tone = 'dark' }: BrandMarkProps) {
  const ring = tone === 'dark' ? '#21997a' : '#064584'
  const core = tone === 'dark' ? '#82d1b6' : '#21997a'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="Genisource"
    >
      <ellipse cx="16" cy="16" rx="15" ry="9" stroke={ring} strokeOpacity="0.28" strokeWidth="1.5" />
      <ellipse cx="16" cy="16" rx="10.5" ry="6.5" stroke={ring} strokeOpacity="0.5" strokeWidth="1.5" />
      <ellipse cx="16" cy="16" rx="6" ry="4" stroke={ring} strokeOpacity="0.78" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="2.2" fill={core} />
    </svg>
  )
}

/**
 * Decorative, oversized ripple used once per screen in the hero corner.
 * Clipped by the parent, so only a quarter of the rings is visible.
 */
export function HeroRipple() {
  return (
    <svg className="hero-ripple" viewBox="0 0 360 360" fill="none" aria-hidden="true">
      <ellipse cx="180" cy="180" rx="176" ry="104" stroke="#21997a" strokeOpacity="0.22" strokeWidth="1" />
      <ellipse cx="180" cy="180" rx="132" ry="78" stroke="#21997a" strokeOpacity="0.18" strokeWidth="1" />
      <ellipse cx="180" cy="180" rx="88" ry="52" stroke="#21997a" strokeOpacity="0.14" strokeWidth="1" />
      <ellipse cx="180" cy="180" rx="44" ry="26" stroke="#21997a" strokeOpacity="0.1" strokeWidth="1" />
    </svg>
  )
}
