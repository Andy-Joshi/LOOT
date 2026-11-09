import React, { useId, useMemo } from 'react'
import './LootLogo.css'

/**
 * Reusable LootLogo Component
 *
 * @param {Object} props
 * @param {boolean} [props.intro=false] - Whether to play the 3-second entrance intro animation
 * @param {boolean} [props.showWordmark=true] - Whether to display the LOOT text wordmark alongside the mark
 * @param {string|number} [props.size='md'] - Preset ('xs', 'sm', 'md', 'lg', 'xl', 'splash') or CSS dimension
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {Object} [props.style={}] - Inline styles
 * @param {string} [props.ariaLabel='Loot logo'] - Accessibility label
 */
export default function LootLogo({
  intro = false,
  showWordmark = true,
  size = 'md',
  className = '',
  style = {},
  ariaLabel = 'Loot logo',
  ...rest
}) {
  const rawId = useId()
  const p = useMemo(() => `loot-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}-`, [rawId])

  const viewBox = showWordmark ? '70 88 260 195' : '98 92 210 135'

  const sizeStyle = useMemo(() => {
    if (typeof size === 'number') {
      return { width: `${size}px`, height: 'auto' }
    }

    const presets = {
      xs: { width: showWordmark ? '110px' : '44px', height: 'auto' },
      sm: { width: showWordmark ? '140px' : '60px', height: 'auto' },
      md: { width: showWordmark ? '190px' : '74px', height: 'auto' },
      lg: { width: showWordmark ? '260px' : '96px', height: 'auto' },
      xl: { width: showWordmark ? 'min(86vw, 470px)' : '140px', height: 'auto' },
      splash: { width: 'min(86vw, 470px)', height: 'auto' }
    }

    if (presets[size]) return presets[size]
    if (typeof size === 'string') return { width: size, height: 'auto' }
    return presets.md
  }, [size, showWordmark])

  return (
    <svg
      className={`loot-logo ${intro ? 'intro' : ''} ${className}`.trim()}
      viewBox={viewBox}
      style={{
        '--d': intro ? '2.8s' : '0s',
        ...sizeStyle,
        ...style
      }}
      role="img"
      aria-label={ariaLabel}
      {...rest}
    >
      <defs>
        <linearGradient id={`${p}RG`} gradientUnits="userSpaceOnUse" x1="-96" x2="96">
          <stop offset="0" stopColor="#67ff3a" />
          <stop offset=".5" stopColor="#7fd0a0" />
          <stop offset="1" stopColor="#8a4dff" />
        </linearGradient>

        <linearGradient id={`${p}NS`} gradientUnits="userSpaceOnUse" x1="-52" y1="-38" x2="52" y2="38">
          <stop offset="0" stopColor="#7dff5a" />
          <stop offset=".55" stopColor="#4a8a6a" />
          <stop offset="1" stopColor="#6a3cff" />
        </linearGradient>

        <linearGradient id={`${p}NB`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#145a1c" />
          <stop offset="1" stopColor="#07140a" />
        </linearGradient>

        <linearGradient id={`${p}NF`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0a1a10" />
          <stop offset="1" stopColor="#1e1048" />
        </linearGradient>

        <linearGradient id={`${p}SG`} x1="0" x2="1">
          <stop offset="0" stopColor="#67ff3a" stopOpacity="0" />
          <stop offset=".5" stopColor="#67ff3a" stopOpacity=".85" />
          <stop offset="1" stopColor="#67ff3a" stopOpacity="0" />
        </linearGradient>

        <radialGradient id={`${p}HG`}>
          <stop offset="0" stopColor="#67ff3a" stopOpacity=".28" />
          <stop offset=".55" stopColor="#8a4dff" stopOpacity=".14" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>

        <path id={`${p}L`} d="M92 229Q92 222 99 222H99Q106 222 106 229V259H133Q140 259 140 266Q140 273 133 273H99Q92 273 92 266Z" />
        <path id={`${p}O1`} fillRule="evenodd" d="M173 222H189Q206 222 206 239V256Q206 273 189 273H173Q156 273 156 256V239Q156 222 173 222ZM179 238H183Q191 238 191 246V249Q191 257 183 257H179Q171 257 171 249V246Q171 238 179 238Z" />
        <path id={`${p}O2`} fillRule="evenodd" d="M229 222H245Q262 222 262 239V256Q262 273 245 273H229Q212 273 212 256V239Q212 222 229 222ZM235 238H239Q247 238 247 246V249Q247 257 239 257H235Q227 257 227 249V246Q227 238 235 238Z" />
        <path id={`${p}T`} d="M268 222H293V236H292V266Q292 273 285 273H278V236H268Z" />

        {showWordmark && (
          <clipPath id={`${p}wc`}>
            <use href={`#${p}L`} />
            <use href={`#${p}O1`} />
            <use href={`#${p}O2`} />
            <use href={`#${p}T`} />
          </clipPath>
        )}
      </defs>

      {/* Atmospheric Halo */}
      <circle className="loot-logo-halo" cx="201" cy="172" r="105" fill={`url(#${p}HG)`} />

      {/* Central Mark */}
      <g className="loot-logo-mark">
        {/* Back Ring Segment & Back Comet */}
        <g transform="translate(201 183) rotate(-12)">
          <path className="loot-logo-ring" pathLength="1" d="M-96 0A96 22 0 0 1 96 0" style={{ stroke: `url(#${p}RG)` }} />
          <path className="loot-logo-cm loot-logo-cb" pathLength="1" d="M96 0A96 22 0 0 0 -96 0" />
        </g>

        {/* Floating Back Neon Card */}
        <g transform="translate(183 154) rotate(-16)">
          <g className="loot-logo-inb">
            <g className="loot-logo-fa">
              <rect x="-50" y="-37" width="100" height="74" rx="14" fill={`url(#${p}NB)`} stroke="#6bff4a" strokeWidth="3" />
            </g>
          </g>
        </g>

        {/* Floating Front Neon Card with Rupee Icon */}
        <g transform="translate(206 172) rotate(-9)">
          <g className="loot-logo-inf">
            <g className="loot-logo-fb">
              <rect x="-52" y="-38" width="104" height="76" rx="14" fill={`url(#${p}NF)`} stroke={`url(#${p}NS)`} strokeWidth="3" />
              <text className="loot-logo-rup" x="0" y="15" textAnchor="middle" fontSize="42" fontWeight="800" fill="#7dff3d" fontFamily="system-ui,sans-serif">
                ₹
              </text>
            </g>
          </g>
        </g>

        {/* Front Ring Segment & Front Comet */}
        <g transform="translate(201 183) rotate(-12)">
          <path className="loot-logo-ring" pathLength="1" d="M-96 0A96 22 0 0 0 96 0" style={{ stroke: `url(#${p}RG)` }} />
          <path className="loot-logo-cm loot-logo-cf" pathLength="1" d="M-96 0A96 22 0 0 0 96 0" />
        </g>

        {/* Burst Circle */}
        <circle className="loot-logo-burst" cx="206" cy="172" r="10" fill="none" stroke="#67ff3a" strokeWidth="2" />
      </g>

      {/* LOOT Wordmark & Sparkles */}
      {showWordmark && (
        <>
          <use href={`#${p}L`} className="loot-logo-ltr" style={{ '--i': 0 }} />
          <use href={`#${p}O1`} className="loot-logo-ltr" style={{ '--i': 1 }} />
          <use href={`#${p}O2`} className="loot-logo-ltr" style={{ '--i': 2 }} />
          <use href={`#${p}T`} className="loot-logo-ltr" style={{ '--i': 3 }} />
          <path className="loot-logo-slash" d="M299 229L313 221H320V224L309 233Z" />
          <g clipPath={`url(#${p}wc)`}>
            <g className="loot-logo-shw">
              <rect x="150" y="214" width="26" height="66" fill={`url(#${p}SG)`} transform="skewX(-18)" />
            </g>
          </g>

          {/* Sparkles */}
          {[
            [118, 120, 0],
            [300, 128, 1],
            [255, 102, 0.6],
            [96, 196, 1.6],
            [290, 205, 2.1]
          ].map(([x, y, t], idx) => (
            <g key={idx} transform={`translate(${x} ${y})`}>
              <path
                className="loot-logo-tw"
                style={{ '--t': `${t}s` }}
                d="M0-5L1.2-1.2L5 0L1.2 1.2L0 5L-1.2 1.2L-5 0L-1.2-1.2Z"
              />
            </g>
          ))}
        </>
      )}
    </svg>
  )
}
