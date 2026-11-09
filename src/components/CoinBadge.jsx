import React from 'react'
import LootCoin from './LootCoin'

/**
 * Reusable Coin Badge for displaying rewards, prices, and balances across LOOT.
 */
export function CoinBadge({
  amount,
  prefix = '',
  suffix = '',
  size = 'sm',
  variant = 'lime',
  glow = false,
  showIcon = true,
  className = '',
  onClick
}) {
  const formatted = typeof amount === 'number'
    ? Math.abs(amount).toLocaleString('en-IN')
    : amount

  const sign = typeof amount === 'number'
    ? (amount > 0 && prefix === '+' ? '+' : amount < 0 ? '-' : prefix)
    : prefix

  return (
    <span
      className={`loot-coin-badge ${size} ${variant} ${glow ? 'glow' : ''} ${onClick ? 'clickable' : ''} ${className}`}
      onClick={onClick}
    >
      {showIcon && <LootCoin size={size === 'lg' ? 'md' : size === 'xl' ? 'lg' : 'xs'} />}
      <span className="coin-badge-text">
        {sign}{formatted}{suffix ? ` ${suffix}` : ''}
      </span>
    </span>
  )
}

export default CoinBadge
