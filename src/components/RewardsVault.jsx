import React, { useState, useMemo } from 'react'
import CoinBadge from './CoinBadge'
import AnimatedNumber from './AnimatedNumber'
import { playCelebrationSound, playCoinSound } from '../utils/sfx'
import './RewardsVault.css'

/**
 * Derives cosmetic rarity from price & category
 */
const getItemRarity = (item) => {
  if (item.category === 'theme' || item.price >= 300) return 'epic'
  if (item.category === 'boost' || item.price >= 200) return 'rare'
  return 'common'
}

/**
 * Filter categories for rewards
 */
const FILTER_CHIPS = [
  { id: 'all', label: 'All Rewards' },
  { id: 'profile', label: 'Profile' },
  { id: 'saver', label: 'Saver' },
  { id: 'boosters', label: 'Boosters' },
  { id: 'themes', label: 'Themes' }
]

export default function RewardsVault({
  storeItems = [],
  profile = {},
  handlePurchase,
  isSpending,
  notify
}) {
  const [activeFilter, setActiveFilter] = useState('all')
  const [unlockedAnimId, setUnlockedAnimId] = useState(null)
  const [confettiActive, setConfettiActive] = useState(false)

  const profileCoins = profile.coins || 0
  const unlockedPerks = useMemo(() => profile.unlockedPerks || [], [profile.unlockedPerks])

  // Filter items
  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return storeItems
    if (activeFilter === 'profile') {
      return storeItems.filter(
        i => i.category === 'cosmetic' || i.category === 'badge' || (i.badge && i.badge.includes('PROFILE'))
      )
    }
    if (activeFilter === 'saver') {
      return storeItems.filter(
        i => i.category === 'utility' || i.category === 'perk' || (i.badge && (i.badge.includes('SAVER') || i.badge.includes('FAMILY')))
      )
    }
    if (activeFilter === 'boosters') {
      return storeItems.filter(
        i => i.category === 'boost' || (i.badge && i.badge.includes('BOOSTER'))
      )
    }
    if (activeFilter === 'themes') {
      return storeItems.filter(
        i => i.category === 'theme' || (i.badge && i.badge.includes('THEME'))
      )
    }
    return storeItems
  }, [storeItems, activeFilter])

  // Featured Reward (next affordable or cheapest unowned)
  const featuredItem = useMemo(() => {
    if (!storeItems.length) return null
    const unowned = storeItems.filter(item => !unlockedPerks.includes(item.id))
    if (unowned.length === 0) return storeItems[0]

    // If affordable items exist, pick the highest price unowned affordable perk
    const affordable = unowned.filter(item => profileCoins >= item.price)
    if (affordable.length > 0) {
      return [...affordable].sort((a, b) => b.price - a.price)[0]
    }

    // Otherwise pick the cheapest unowned perk (closest to unlock)
    return [...unowned].sort((a, b) => a.price - b.price)[0]
  }, [storeItems, unlockedPerks, profileCoins])

  // Trigger purchase with card burst animation and sfx
  const triggerPurchase = async (item) => {
    if (isSpending) return
    if (profileCoins < item.price) {
      if (notify) notify(`Need ${item.price - profileCoins} more coins to unlock "${item.name}"!`)
      return
    }

    setUnlockedAnimId(item.id)
    setConfettiActive(true)
    playCelebrationSound()
    playCoinSound()

    try {
      await handlePurchase(item)
    } finally {
      setTimeout(() => {
        setConfettiActive(false)
        setUnlockedAnimId(null)
      }, 2000)
    }
  }

  // Generate 20 confetti bursts on unlock
  const confettiParticles = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => {
      const angle = (i / 24) * 2 * Math.PI
      const dist = 60 + (i % 4) * 25
      const tx = Math.round(Math.cos(angle) * dist)
      const ty = Math.round(Math.sin(angle) * dist)
      const colors = ['#67ff3a', '#8a4dff', '#ffbe26', '#00e5ff', '#ff4da6']
      return {
        id: i,
        color: colors[i % colors.length],
        tx,
        ty,
        rot: (i * 45) % 360,
        size: 6 + (i % 3) * 3
      }
    })
  }, [])

  return (
    <div className="rewards-vault-container">
      {/* 1. SECTION HEADING */}
      <div className="rewards-head">
        <div>
          <span className="section-kicker">REWARDS VAULT</span>
          <h2>Unlock Perks With Your Coins</h2>
          <p className="rewards-subhead">
            Spend virtual coins earned from healthy saving habits on avatar upgrades, streak protectors, and arcade perks.
          </p>
        </div>
        <div className="rewards-vault-balance-pill">
          <span className="vault-balance-label">AVAILABLE COINS</span>
          <div className="vault-balance-val">
            <CoinBadge amount={profileCoins} size="md" variant="lime" />
          </div>
        </div>
      </div>

      {/* 2. FEATURED REWARD BANNER */}
      {featuredItem && (
        <div className={`featured-reward-banner rarity-${getItemRarity(featuredItem)}`}>
          <div className="featured-banner-glow" />
          <div className="featured-banner-inner">
            <div className="featured-badge-col">
              <span className="featured-kicker">✦ FEATURED REWARD</span>
              <div className="featured-icon-box">
                <span className="featured-icon">{featuredItem.icon}</span>
                <span className={`rarity-tag ${getItemRarity(featuredItem)}`}>
                  {getItemRarity(featuredItem).toUpperCase()}
                </span>
              </div>
            </div>

            <div className="featured-content-col">
              <div className="featured-meta-row">
                <span className="featured-item-badge">{featuredItem.badge}</span>
                <span className="featured-price-tag">
                  <AnimatedNumber value={featuredItem.price} /> ◈ COINS
                </span>
              </div>
              <h3 className="featured-title">{featuredItem.name}</h3>
              <p className="featured-desc">{featuredItem.description}</p>

              {/* Progress towards unlocking */}
              <div className="featured-progress-bar">
                <div
                  className="featured-progress-fill"
                  style={{
                    width: `${Math.min(100, Math.round((Math.min(profileCoins, featuredItem.price) / featuredItem.price) * 100))}%`
                  }}
                />
              </div>
              <div className="featured-status-row">
                <span className="featured-progress-ratio">
                  {Math.min(profileCoins, featuredItem.price)} / {featuredItem.price} coins collected
                </span>
                {unlockedPerks.includes(featuredItem.id) ? (
                  <span className="featured-unlocked-tag">✓ ALREADY OWNED</span>
                ) : profileCoins >= featuredItem.price ? (
                  <button
                    className="primary-button featured-unlock-btn pulse"
                    disabled={isSpending}
                    onClick={() => triggerPurchase(featuredItem)}
                  >
                    ✦ Unlock Now ({featuredItem.price} ◈)
                  </button>
                ) : (
                  <span className="featured-away-text">
                    {featuredItem.price - profileCoins} more coins to unlock
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. FILTER CHIPS */}
      <div className="rewards-filter-strip" role="tablist" aria-label="Reward categories">
        {FILTER_CHIPS.map(chip => (
          <button
            key={chip.id}
            className={`filter-chip ${activeFilter === chip.id ? 'active' : ''}`}
            onClick={() => setActiveFilter(chip.id)}
            role="tab"
            aria-selected={activeFilter === chip.id}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* 4. REWARDS RESPONSIVE GRID (3 col desktop, 2 col tablet, 1 col mobile) */}
      <div className="rewards-grid">
        {filteredItems.map(item => {
          const isOwned = unlockedPerks.includes(item.id) && item.category !== 'boost'
          const canAfford = !isOwned && profileCoins >= item.price
          const isLocked = !isOwned && !canAfford
          const rarity = getItemRarity(item)
          const isBursting = unlockedAnimId === item.id

          const coinProgress = Math.min(profileCoins, item.price)
          const progressPercent = Math.min(100, Math.round((coinProgress / item.price) * 100))

          let stateClass = 'state-locked'
          if (isOwned) stateClass = 'state-owned'
          else if (canAfford) stateClass = 'state-affordable'

          return (
            <div
              key={item.id}
              className={`reward-card card ${stateClass} rarity-${rarity} ${isBursting ? 'just-unlocked' : ''}`}
            >
              {/* Affordable Shimmer Sweep */}
              {canAfford && <span className="shimmer-sweep" />}

              {/* Confetti Explosion Layer on Unlock */}
              {isBursting && confettiActive && (
                <div className="card-confetti-container">
                  {confettiParticles.map(p => (
                    <span
                      key={p.id}
                      className="confetti-particle"
                      style={{
                        '--tx': `${p.tx}px`,
                        '--ty': `${p.ty}px`,
                        '--rot': `${p.rot}deg`,
                        backgroundColor: p.color,
                        width: `${p.size}px`,
                        height: `${p.size * 0.7}px`
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Card Header: Icon, Rarity Tag, Lock / Check Badge */}
              <div className="reward-card-top">
                <div className="reward-icon-wrap">
                  <span className="reward-item-icon">{item.icon}</span>
                  {isLocked && <span className="lock-overlay" title="Locked">🔒</span>}
                  {isOwned && <span className="check-overlay" title="Owned">✓</span>}
                </div>

                <div className="reward-tags">
                  <span className={`rarity-tag ${rarity}`}>{rarity.toUpperCase()}</span>
                  <span className="reward-category-badge">{item.badge}</span>
                </div>
              </div>

              {/* Title & Description */}
              <div className="reward-card-content">
                <h3 className="reward-item-name">{item.name}</h3>
                <p className="reward-item-desc">{item.description}</p>
              </div>

              {/* Card Footer Based on State */}
              <div className="reward-card-bottom">
                {/* 1. OWNED STATE */}
                {isOwned && (
                  <div className="bottom-owned-wrap">
                    <span className="reward-cost owned">◈ {item.price}</span>
                    <span className="owned-tag-badge">✓ Owned</span>
                  </div>
                )}

                {/* 2. AFFORDABLE STATE */}
                {canAfford && (
                  <div className="bottom-affordable-wrap">
                    <div className="reward-cost affordable">
                      <CoinBadge amount={item.price} size="md" variant="lime" />
                    </div>
                    <button
                      className="primary-button unlock-action-btn pulse"
                      disabled={isSpending}
                      onClick={() => triggerPurchase(item)}
                    >
                      ✦ Unlock
                    </button>
                  </div>
                )}

                {/* 3. LOCKED STATE */}
                {isLocked && (
                  <div className="bottom-locked-wrap">
                    <div className="locked-cost-row">
                      <span className="reward-cost locked">◈ {item.price}</span>
                      <span className="need-more-label">
                        Need {item.price - profileCoins} more
                      </span>
                    </div>

                    {/* Coin Progress Bar */}
                    <div className="locked-progress-track">
                      <div
                        className="locked-progress-fill"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="locked-ratio-sub">
                      <span>{coinProgress} / {item.price} coins</span>
                      <span>{progressPercent}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
