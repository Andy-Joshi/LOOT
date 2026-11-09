import React from 'react'
import './MrSpark.css'
import { SPARK_HELP_TOPICS } from './sparkTutorial'

export default function MrSpark({ spark }) {
  const {
    mode,
    mood,
    bubbleOpen,
    bubbleKicker,
    bubbleText,
    bubbleButtons,
    helpMenuOpen,
    particles,
    rings,
    pupilOffset,
    sparkElRef,
    handleSparkClick,
    handleSelectTopic,
    hideBubble
  } = spark

  if (mode === 'hidden') return null

  const isIntro = mode === 'intro'
  const moodClass = mood === 'wave'
    ? 'spark-wave'
    : mood === 'cheer'
    ? 'spark-cheer'
    : mood === 'talk'
    ? 'spark-talk'
    : ''

  return (
    <>
      {/* Dim Overlay when Intro Mode is active */}
      <div
        className={`spark-dim ${isIntro ? 'on' : ''}`}
        onClick={isIntro ? () => spark.toDock(false) : undefined}
        aria-hidden="true"
      />

      {/* Particle Shockwave Rings */}
      {rings.map((r) => (
        <div
          key={r.id}
          className="spark-rng"
          style={{ left: `${r.x}px`, top: `${r.y}px` }}
          aria-hidden="true"
        />
      ))}

      {/* Flying Particle Sparks */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="spark-bp"
          style={{
            left: `${p.x}px`,
            top: `${p.y}px`,
            backgroundColor: p.color,
            '--x': `${p.targetX}px`,
            '--y': `${p.targetY}px`
          }}
          aria-hidden="true"
        />
      ))}

      {/* Spark Character & Speech Bubble */}
      <div
        ref={sparkElRef}
        className={`spark ${mode} ${moodClass}`}
        role="button"
        tabIndex={0}
        aria-label="Mr. Spark, your guide. Tap for help or a guided tour"
        onClick={handleSparkClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleSparkClick()
          }
        }}
      >
        {/* Speech Bubble */}
        <div
          className={`spark-bub ${bubbleOpen ? 'on' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {bubbleKicker && (
            <div className="spark-bub-kicker">
              <span className="spark-live-dot" />
              <span>{bubbleKicker}</span>
            </div>
          )}

          <div className="spark-bub-text">{bubbleText}</div>

          {/* Interactive Help Menu Topics */}
          {helpMenuOpen && (
            <div className="spark-help-menu">
              {SPARK_HELP_TOPICS.map((topic) => (
                <button
                  key={topic.id}
                  className="spark-help-item"
                  onClick={() => handleSelectTopic(topic)}
                >
                  <span className="spark-help-title">{topic.title}</span>
                  <span className="spark-help-desc">{topic.desc}</span>
                </button>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          {bubbleButtons.length > 0 && (
            <div className="spark-bub-btns">
              {bubbleButtons.map((btn, idx) => (
                <button
                  key={idx}
                  className={`spark-btn ${btn.primary ? 'primary' : 'secondary'}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    btn.onClick()
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* SVG Mascot Character */}
        <svg className="char" viewBox="0 0 300 340" aria-hidden="true">
          <defs>
            <linearGradient id="spark_gC" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#67ff3a" />
              <stop offset="0.55" stopColor="#3fcf2a" />
              <stop offset="1" stopColor="#7a3cff" />
            </linearGradient>
            <linearGradient id="spark_gB" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#2f2447" />
              <stop offset="0.5" stopColor="#15101f" />
              <stop offset="1" stopColor="#0a0810" />
            </linearGradient>
            <linearGradient id="spark_gS" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7dff4a" />
              <stop offset="1" stopColor="#27b82e" />
            </linearGradient>
            <radialGradient id="spark_gG" cx="0.35" cy="0.3">
              <stop offset="0" stopColor="#ffe98a" />
              <stop offset="1" stopColor="#ee9f12" />
            </radialGradient>
          </defs>

          {/* Glowing Base Ring */}
          <g className="ring">
            <ellipse cx="150" cy="320" rx="78" ry="11" fill="none" stroke="#67ff3a" strokeWidth="3.5" className="glow" />
            <ellipse cx="150" cy="320" rx="46" ry="6" fill="none" stroke="#67ff3a" strokeOpacity="0.6" strokeWidth="2" />
          </g>

          {/* Bobbing Body Group */}
          <g className="bobg">
            {/* Cape Left & Right */}
            <g className="capeL">
              <path d="M112 178C80 176 40 190 26 214C22 230 40 246 62 238C84 230 104 220 120 206Z" fill="url(#spark_gC)" />
              <path d="M34 218C50 212 78 206 112 196" stroke="#b6ff90" strokeOpacity="0.5" strokeWidth="3" fill="none" />
            </g>
            <g className="capeR">
              <path d="M190 180C214 178 246 186 262 204C268 216 252 226 238 224C222 220 204 212 192 204Z" fill="url(#spark_gC)" />
            </g>

            {/* Left Leg & Sneaker */}
            <g className="legL">
              <path d="M110 204L108 246" stroke="#14101c" strokeWidth="17" strokeLinecap="round" />
              <g transform="translate(100 258) scale(-1 1)">
                <path d="M-24 4Q-26 -14 -8 -18L14 -16Q30 -12 32 2Q32 10 20 10L-18 10Q-24 10 -24 4Z" fill="#17121f" stroke="#2c2540" />
                <path d="M-26 8Q4 16 32 8" stroke="#f2eefc" strokeWidth="5" strokeLinecap="round" fill="none" />
                <path d="M-2 -14l8 6M6 -16l8 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M-14 -2l4 -6l1 5l5 -3" stroke="#67ff3a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              </g>
            </g>

            {/* Right Leg & Sneaker */}
            <g className="legR">
              <path d="M190 204L194 244" stroke="#14101c" strokeWidth="17" strokeLinecap="round" />
              <g transform="translate(202 256)">
                <path d="M-24 4Q-26 -14 -8 -18L14 -16Q30 -12 32 2Q32 10 20 10L-18 10Q-24 10 -24 4Z" fill="#17121f" stroke="#2c2540" />
                <path d="M-26 8Q4 16 32 8" stroke="#f2eefc" strokeWidth="5" strokeLinecap="round" fill="none" />
                <path d="M-2 -14l8 6M6 -16l8 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M-14 -2l4 -6l1 5l5 -3" stroke="#67ff3a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              </g>
            </g>

            {/* Bills / Cash on Head */}
            <g transform="rotate(-10 142 71)">
              <rect x="92" y="40" width="100" height="62" rx="9" fill="#6bdc72" stroke="#a8ffa0" strokeWidth="2" />
              <rect x="104" y="50" width="76" height="6" rx="3" fill="#4cc058" />
            </g>

            {/* Floating Top Rupee Coin */}
            <g className="topcoin">
              <circle cx="210" cy="64" r="24" fill="url(#spark_gG)" stroke="#c9860e" strokeWidth="3" />
              <text x="210" y="73" textAnchor="middle" fontSize="24" fontWeight="800" fill="#8a5a00" fontFamily="system-ui, sans-serif">₹</text>
            </g>

            {/* Head & Torso with Cyberpunk Circuits */}
            <g transform="rotate(-4 150 150)">
              <rect x="70" y="70" width="160" height="136" rx="26" fill="url(#spark_gB)" />
              <path d="M110 71H204Q228 71 229 96" stroke="#8a5dff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.85" />
              <path d="M82 106Q150 120 218 106" stroke="#b6ff5a" strokeWidth="1.8" strokeDasharray="4 4" fill="none" />
              <path d="M86 82H214" stroke="#b6ff5a" strokeWidth="1.6" strokeDasharray="4 4" fill="none" opacity="0.7" />
              <path d="M82 76V94H96" stroke="#67ff3a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="glow" />
              <rect x="218" y="108" width="20" height="46" rx="9" fill="#1b1526" stroke="#5b3fa8" strokeWidth="2" />
              <path d="M70 186Q150 208 230 186L230 204Q150 226 70 204Z" fill="url(#spark_gS)" />

              {/* Glowing Visor Glasses */}
              <g className="glow">
                <rect x="86" y="104" width="60" height="46" rx="14" fill="rgba(103,255,58,0.14)" stroke="#67ff3a" strokeWidth="4.5" />
                <rect x="154" y="104" width="60" height="46" rx="14" fill="rgba(103,255,58,0.14)" stroke="#67ff3a" strokeWidth="4.5" />
                <path d="M146 122Q150 117 154 122M86 118L72 114M214 118L228 114" stroke="#67ff3a" strokeWidth="4" fill="none" strokeLinecap="round" />
              </g>

              {/* Eyes & Interactive Pupils */}
              <g className="eyes">
                <ellipse cx="116" cy="127" rx="15" ry="17" fill="#f5fff6" />
                <ellipse cx="184" cy="127" rx="15" ry="17" fill="#f5fff6" />
                <g id="spark_pup" style={{ transform: `translate(${pupilOffset.x}px, ${pupilOffset.y}px)` }}>
                  <circle cx="118" cy="129" r="10" fill="#0f4a2a" stroke="#3fe07a" strokeWidth="2" />
                  <circle cx="186" cy="129" r="10" fill="#0f4a2a" stroke="#3fe07a" strokeWidth="2" />
                  <circle cx="122" cy="124" r="3.2" fill="#fff" />
                  <circle cx="190" cy="124" r="3.2" fill="#fff" />
                </g>
              </g>

              {/* Eyebrows */}
              <path d="M104 96Q118 87 134 94M166 94Q184 86 200 96" stroke="#07050c" strokeWidth="4" fill="none" strokeLinecap="round" />

              {/* Animated Mouth */}
              <g className="mouth">
                <path d="M135 158Q150 184 165 158Z" fill="#2a0d16" />
                <ellipse cx="150" cy="167" rx="8" ry="4.5" fill="#ff7a96" />
              </g>

              {/* Belt Buckle Medal */}
              <circle cx="150" cy="208" r="15" fill="url(#spark_gG)" stroke="#c9860e" strokeWidth="2.5" />
              <text x="150" y="214" textAnchor="middle" fontSize="17" fontWeight="800" fill="#4a3000" fontFamily="system-ui, sans-serif">L</text>

              {/* Left Arm & Glove */}
              <g className="armL">
                <path d="M74 152Q48 150 40 124" stroke="#14101c" strokeWidth="13" strokeLinecap="round" fill="none" />
                <rect x="22" y="100" width="30" height="26" rx="12" fill="#f3f0fa" stroke="#cfc8e0" />
                <rect x="25" y="74" width="14" height="32" rx="7" fill="#f3f0fa" stroke="#cfc8e0" transform="rotate(-8 32 90)" />
                <path d="M28 114h20M28 120h16" stroke="#cfc8e0" strokeWidth="2" strokeLinecap="round" />
              </g>

              {/* Right Arm & Hand */}
              <g className="armR">
                <path d="M226 154Q252 160 262 180" stroke="#14101c" strokeWidth="13" strokeLinecap="round" fill="none" />
                <circle cx="268" cy="188" r="15" fill="#f3f0fa" stroke="#cfc8e0" />
                <ellipse cx="282" cy="196" rx="7" ry="9" fill="#f3f0fa" stroke="#cfc8e0" transform="rotate(-30 282 196)" />
                <ellipse cx="270" cy="204" rx="7" ry="9" fill="#f3f0fa" stroke="#cfc8e0" />
              </g>
            </g>

            {/* Glowing Golden Crown */}
            <path
              className="crown"
              d="M40 56L46 30L62 44L72 22L84 44L100 30L104 56ZM48 64Q72 56 98 64"
              fill="none"
              stroke="#ffd84a"
              strokeWidth="3.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Floating Bar Chart & Growth Arrow */}
            <g className="glow" transform="translate(240 118)">
              <g className="bars" fill="#67ff3a">
                <rect x="0" y="28" width="9" height="16" rx="2" />
                <rect x="14" y="16" width="9" height="28" rx="2" />
                <rect x="28" y="2" width="9" height="42" rx="2" />
              </g>
              <path d="M-2 14L14 0L24 -8M14 -10H26V2" stroke="#67ff3a" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>

            {/* Sparkle Triangles */}
            <g transform="translate(232 40)" stroke="#8affc4" strokeWidth="2.5" fill="none" strokeLinejoin="round">
              <path className="tri" d="M0 0L22 8L4 18Z" />
              <path className="tri" d="M26 24L38 26L30 34Z" style={{ animationDelay: '0.5s' }} />
            </g>

            {/* Flipping Floating Coin */}
            <g className="fcoin">
              <g transform="translate(252 232)">
                <g className="flip">
                  <circle r="17" fill="url(#spark_gG)" stroke="#c9860e" strokeWidth="2.5" />
                  <text y="7" textAnchor="middle" fontSize="19" fontWeight="800" fill="#8a5a00" fontFamily="system-ui, sans-serif">₹</text>
                </g>
              </g>
            </g>
          </g>
        </svg>
      </div>
    </>
  )
}
