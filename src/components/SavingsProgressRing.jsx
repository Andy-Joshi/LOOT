import React, { useEffect, useState } from 'react'
import AnimatedNumber from './AnimatedNumber'
import './SavingsProgressRing.css'

/**
 * SavingsProgressRing Component
 *
 * Crisp SVG circular progress ring with gradient stroke (neon green to purple),
 * smooth animation on load, and perfectly centered percentage and label.
 *
 * @param {Object} props
 * @param {number} props.percent - Progress percentage (0 - 100)
 * @param {number} [props.size=144] - Diameter in pixels
 * @param {number} [props.strokeWidth=12] - Ring stroke width
 */
export default function SavingsProgressRing({ percent = 0, size = 144, strokeWidth = 12 }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(t)
  }, [])

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const validPercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)))
  const strokeDashoffset = mounted
    ? circumference - (validPercent / 100) * circumference
    : circumference

  return (
    <div className="savings-progress-ring-container" style={{ width: size, height: size }}>
      <svg
        className="savings-progress-ring"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Savings progress: ${validPercent}%`}
      >
        <defs>
          <linearGradient id="savingsProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#67ff3a" />
            <stop offset="65%" stopColor="#8a4dff" />
            <stop offset="100%" stopColor="#67ff3a" />
          </linearGradient>
          <filter id="savingsProgressGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background Track */}
        <circle
          className="savings-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Dynamic Animated Stroke */}
        <circle
          className="savings-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke="url(#savingsProgressGrad)"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          filter="url(#savingsProgressGlow)"
        />
      </svg>

      {/* Centered Numbers & Label */}
      <div className="savings-ring-center">
        <strong className="savings-ring-percent">
          <AnimatedNumber value={validPercent} />%
        </strong>
        <span className="savings-ring-sublabel">SAVED</span>
      </div>
    </div>
  )
}
