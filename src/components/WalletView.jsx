import React, { useState, useMemo } from 'react'
import LootCoin from './LootCoin'
import CoinBadge from './CoinBadge'
import TransactionModal from './TransactionModal'
import RewardsVault from './RewardsVault'
import { getSmartBuySavings } from '../services/smartBuyStorage'

export function WalletView({ state, refresh, notify, accountingState, smartBuySavings: propSavings }) {
  const [filter, setFilter] = useState('all')
  const [financialFilter, setFinancialFilter] = useState('all')
  const [ledgerMode, setLedgerMode] = useState('financial') // 'financial' | 'coins'
  const [search, setSearch] = useState('')
  const [selectedTx, setSelectedTx] = useState(null)
  const [isSpending, setIsSpending] = useState(false)
  const [activeTab, setActiveTab] = useState('ledger') // 'ledger' | 'store'

  const profile = state.profile || {}
  const coinStats = state.coinStats || {
    balance: profile.coins || 0,
    totalEarned: profile.coins || 0,
    totalSpent: 0,
    totalTransactions: 0,
    rank: profile.rank || 'Saving Rookie',
    level: 1,
    progressPercent: 50,
    currentLevelMin: 0,
    nextLevelThreshold: 1000,
    coinsNeededForNext: 0
  }

  const transactions = useMemo(() => state.coinTransactions || [], [state.coinTransactions])
  const storeItems = state.storeItems || []
  const unlockedPerks = profile.unlockedPerks || []

  // Balance separation metrics
  const goalsList = useMemo(() => state.goals || [], [state.goals])
  const availableCash = accountingState?.availableBalance !== undefined ? accountingState.availableBalance : 0
  const goalSavingsTotal = accountingState?.goalSavings !== undefined
    ? accountingState.goalSavings
    : goalsList.reduce((sum, g) => sum + Math.max(0, Number(g.saved) || 0), 0)
  const lockedFundsTotal = useMemo(() => {
    if (accountingState?.lockedFunds !== undefined) return accountingState.lockedFunds
    const now = Date.now()
    return (state?.parentRequests || [])
      .filter(pr => pr.status === 'approved' && (!pr.expires_at || new Date(pr.expires_at).getTime() > now))
      .reduce((sum, pr) => sum + (Number(pr.requested_amount) || 0), 0)
  }, [accountingState?.lockedFunds, state?.parentRequests])
  const totalOwnedMoney = Math.max(0, Math.round((availableCash + goalSavingsTotal) * 100) / 100)

  const stateTxs = state?.transactions
  const acctTxs = accountingState?.transactions

  // Financial movements (Cash & Goal transactions) with dual-source deduplication
  const financialTransactions = useMemo(() => {
    const list = [...(stateTxs || [])]
    if (acctTxs?.length) {
      const existingIds = new Set(list.map(t => String(t.id)))
      for (const t of acctTxs) {
        if (!existingIds.has(String(t.id))) {
          list.push(t)
        }
      }
    }

    // Content-based deduplication
    const seen = new Set()
    const deduplicated = []
    for (const t of list) {
      const txTime = t.timestamp ? Math.floor(t.timestamp / 5000) * 5000 : (t.date || '')
      const key = `${(t.type || '').toUpperCase()}_${Math.abs(Number(t.amount) || 0)}_${(t.title || '').trim().toLowerCase()}_${txTime}`
      if (!seen.has(key)) {
        seen.add(key)
        deduplicated.push(t)
      }
    }

    return deduplicated.sort((a, b) => {
      const timeA = a.timestamp || (a.date ? new Date(a.date).getTime() : 0) || Number(a.id) || 0
      const timeB = b.timestamp || (b.date ? new Date(b.date).getTime() : 0) || Number(b.id) || 0
      return timeB - timeA
    })
  }, [stateTxs, acctTxs])

  // Filtered financial movements
  const filteredFinancialTransactions = useMemo(() => {
    let list = [...financialTransactions]

    if (financialFilter === 'goal_contrib') {
      list = list.filter(t => (t.type || '').toUpperCase() === 'GOAL_CONTRIBUTION')
    } else if (financialFilter === 'goal_withdr') {
      list = list.filter(t => (t.type || '').toUpperCase() === 'GOAL_WITHDRAWAL')
    } else if (financialFilter === 'expense') {
      list = list.filter(t => (t.type || '').toUpperCase() === 'EXPENSE' || (Number(t.amount) < 0 && (t.type || '').toUpperCase() !== 'GOAL_CONTRIBUTION'))
    } else if (financialFilter === 'income') {
      list = list.filter(t => (t.type || '').toUpperCase() === 'MONEY_ADDED' || (Number(t.amount) > 0 && (t.type || '').toUpperCase() !== 'GOAL_WITHDRAWAL'))
    } else if (financialFilter === 'parent') {
      list = list.filter(t => ['PARENT_APPROVAL_LOCKED', 'PARENT_FUNDS_UNLOCKED', 'PARENT_APPROVAL_EXPIRED'].includes((t.type || '').toUpperCase()))
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(t =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q) ||
        (t.goalName || '').toLowerCase().includes(q) ||
        (t.type || '').toLowerCase().includes(q)
      )
    }

    return list
  }, [financialTransactions, financialFilter, search])

  // Filtered transactions for the coin ledger
  const filteredTransactions = useMemo(() => {
    let list = [...transactions]

    // Category or Type Filter
    if (filter === 'earned') {
      list = list.filter(t => t.type === 'earn')
    } else if (filter === 'spent') {
      list = list.filter(t => t.type === 'spend')
    } else if (filter !== 'all') {
      list = list.filter(t => (t.category || '').toLowerCase() === filter.toLowerCase())
    }

    // Search query filter
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      list = list.filter(t =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q) ||
        (t.source || '').toLowerCase().includes(q) ||
        (t.referenceId || '').toLowerCase().includes(q)
      )
    }

    return list
  }, [transactions, filter, search])

  // Purchase a store item / perk
  const handlePurchase = async (item) => {
    if (isSpending) return

    if (item.category !== 'boost' && unlockedPerks.includes(item.id)) {
      return notify(`You already own "${item.name}"!`)
    }

    if (profile.coins < item.price) {
      return notify(`Need ${item.price - profile.coins} more coins to unlock "${item.name}"!`)
    }

    setIsSpending(true)
    try {
      const response = await fetch('/api/coins/spend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          idempotencyKey: `client_spend_${item.id}_${Date.now()}`
        })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to redeem reward')
      }

      await refresh()
      notify(`Unlocked ${item.name}! -${item.price} LOOT Coins.`)
    } catch (err) {
      notify(err.message || 'Error spending coins')
    } finally {
      setIsSpending(false)
    }
  }

  const coinFilterTabs = [
    { id: 'all', label: 'All Coins' },
    { id: 'earned', label: 'Earned (+)' },
    { id: 'spent', label: 'Spent (-)' },
    { id: 'challenges', label: 'Challenges' },
    { id: 'goals', label: 'Goals' },
    { id: 'achievements', label: 'Achievements' },
    { id: 'chores', label: 'Chores' },
    { id: 'rewards', label: 'Rewards' },
    { id: 'activities', label: 'Activities' }
  ]

  const financialFilterTabs = [
    { id: 'all', label: 'All Movements' },
    { id: 'goal_contrib', label: '🎯 Goal Contributions' },
    { id: 'goal_withdr', label: '↺ Goal Withdrawals' },
    { id: 'expense', label: '↘ Expenses' },
    { id: 'income', label: '↗ Income / Added' },
    { id: 'parent', label: '🔒 Parent Approvals' }
  ]

  return (
    <div className="wallet-view-container">
      {/* Page Header */}
      <div className="page-hero wallet-hero-header">
        <div>
          <span className="section-kicker">CENTRAL LEDGER & ECONOMY</span>
          <h1>LOOT Coin Vault</h1>
          <p>Your gamified digital balance, certified transaction ledger, and unlockable rewards.</p>
        </div>
        <div className="wallet-view-tabs">
          <button
            className={`tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
            onClick={() => setActiveTab('ledger')}
          >
            Ledger & History
          </button>
          <button
            className={`tab-btn ${activeTab === 'store' ? 'active' : ''}`}
            onClick={() => setActiveTab('store')}
          >
            Rewards Store
            <span className="badge-count">{storeItems.length}</span>
          </button>
        </div>
      </div>

      {/* Main Gaming Wallet Card */}
      <section className="wallet-card card">
        <div className="wallet-card-circuit" />
        <div className="wallet-card-grid">
          <div className="wallet-primary-balance">
            <div className="balance-eyebrow">
              <span className="pulse-dot" /> LIVE ENGINE SYNCHRONIZED
            </div>

            <div className="balance-counter-wrap">
              <LootCoin size="xl" glow className="hero-coin-icon" />
              <div className="balance-figures">
                <span className="balance-unit">CURRENT BALANCE</span>
                <strong className="balance-number">
                  {(profile.coins || 0).toLocaleString('en-IN')}
                </strong>
                <span className="balance-ticker">LOOT COINS</span>
              </div>
            </div>

            <div className="wallet-level-badge-row">
              <span className={`rank-pill ${coinStats.color || 'lime'}`}>
                ★ Level {coinStats.level || 1} · {coinStats.rank || profile.rank}
              </span>
              <span className="rank-perk-hint">
                {coinStats.coinsNeededForNext > 0
                  ? `${coinStats.coinsNeededForNext} coins until Level ${(coinStats.level || 1) + 1}`
                  : 'MAX LEVEL ACHIEVED'}
              </span>
            </div>

            {/* Level XP Bar */}
            <div className="level-xp-wrap">
              <div className="level-xp-labels">
                <span>XP Progress</span>
                <b>{coinStats.progressPercent}%</b>
              </div>
              <div className="level-xp-track">
                <div
                  className="level-xp-fill"
                  style={{ width: `${coinStats.progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Metrics Column */}
          <div className="wallet-stats-column">
            <div className="wallet-stat-tile earned-tile">
              <span className="stat-symbol-coin green">↗</span>
              <div>
                <span className="stat-tile-label">TOTAL EARNED</span>
                <strong className="credit-text">
                  +{(coinStats.totalEarned || 0).toLocaleString('en-IN')}
                </strong>
                <small>Lifetime rewards</small>
              </div>
            </div>

            <div className="wallet-stat-tile spent-tile">
              <span className="stat-symbol-coin pink">↘</span>
              <div>
                <span className="stat-tile-label">TOTAL SPENT</span>
                <strong className="debit-text">
                  -{(coinStats.totalSpent || 0).toLocaleString('en-IN')}
                </strong>
                <small>Redeemed perks</small>
              </div>
            </div>

            <div className="wallet-stat-tile ledger-tile">
              <span className="stat-symbol-coin cyan">◈</span>
              <div>
                <span className="stat-tile-label">VERIFIED LEDGER</span>
                <strong>{transactions.length} Entries</strong>
                <small>Safe atomic audit trail</small>
              </div>
            </div>

            {accountingState && (
              <div className="wallet-stat-tile cash-tile" style={{ borderLeft: '3px solid #67ff3a' }}>
                <span className="stat-symbol-coin green">₹</span>
                <div>
                  <span className="stat-tile-label">AVAILABLE CASH</span>
                  <strong className="credit-text">
                    ₹{(accountingState.availableBalance || 0).toLocaleString('en-IN')}
                  </strong>
                  <small>
                    {accountingState.outstandingShortfall > 0
                      ? `⚠️ -₹${accountingState.outstandingShortfall.toLocaleString('en-IN')} shortfall`
                      : 'Cleared & balanced'}
                  </small>
                </div>
              </div>
            )}

            {/* Smart Buy Savings Metric Card */}
            <div className="wallet-stat-tile smartbuy-tile" style={{ borderLeft: '3px solid #8a4dff' }}>
              <span className="stat-symbol-coin purple" style={{ background: '#8a4dff', color: '#fff' }}>🛍️</span>
              <div>
                <span className="stat-tile-label">SAVED BY COMPARING</span>
                <strong className="credit-text" style={{ color: '#c9a8ff' }}>
                  ₹{((propSavings !== undefined ? propSavings : getSmartBuySavings()) || 0).toLocaleString('en-IN')}
                </strong>
                <small>Smart Buy price optimizations</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WALLET ALLOCATION & FUNDS ARCHITECTURE */}
      <section className="wallet-allocation-section" aria-label="Wallet funds allocation" style={{ marginTop: '20px' }}>
        <div className="section-head-minimal" style={{ marginBottom: '12px' }}>
          <div>
            <span className="section-kicker" style={{ color: '#67ff3a' }}>FUNDS ARCHITECTURE</span>
            <h2 style={{ fontSize: '18px', margin: '4px 0 2px' }}>Wallet Balance Allocation</h2>
            <p style={{ margin: 0, color: '#8c9c8e', fontSize: '11px' }}>
              Authoritative financial separation of available spending cash, active goal savings, and locked parent funds.
            </p>
          </div>
        </div>

        <div className="wallet-allocation-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {/* 1. Total Owned Money */}
          <div className="card allocation-card total-owned-card" style={{ padding: '16px', background: '#121a13', border: '1px solid #2d4530', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '10px', color: '#97a898', fontWeight: 600, letterSpacing: '0.5px' }}>TOTAL OWNED MONEY</span>
              <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', color: '#e8f2e9' }}>
                💼 Net Funds
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-mono, monospace)', margin: '4px 0' }}>
              ₹{totalOwnedMoney.toLocaleString('en-IN')}
            </div>
            <p style={{ margin: 0, color: '#7a8c7c', fontSize: '11px' }}>
              Available balance + active goal savings combined.
            </p>
          </div>

          {/* 2. Available Balance */}
          <div className="card allocation-card available-card" style={{ padding: '16px', background: '#121a13', border: '1px solid #67ff3a', borderRadius: '10px', boxShadow: '0 0 14px rgba(103, 255, 58, 0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '10px', color: '#67ff3a', fontWeight: 600, letterSpacing: '0.5px' }}>AVAILABLE BALANCE</span>
              <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(103, 255, 58, 0.15)', borderRadius: '4px', color: '#67ff3a' }}>
                ✓ Spending Ready
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#67ff3a', fontFamily: 'var(--font-mono, monospace)', margin: '4px 0' }}>
              ₹{availableCash.toLocaleString('en-IN')}
            </div>
            <p style={{ margin: 0, color: '#8c9c8e', fontSize: '11px' }}>
              Liquid funds available for everyday spending & goal allocation.
            </p>
          </div>

          {/* 3. Goal Savings */}
          <div className="card allocation-card goals-card" style={{ padding: '16px', background: '#121a13', border: '1px solid #00e5ff', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '10px', color: '#00e5ff', fontWeight: 600, letterSpacing: '0.5px' }}>GOAL SAVINGS</span>
              <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(0, 229, 255, 0.15)', borderRadius: '4px', color: '#00e5ff' }}>
                🎯 {goalsList.length} Goals
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#00e5ff', fontFamily: 'var(--font-mono, monospace)', margin: '4px 0' }}>
              ₹{goalSavingsTotal.toLocaleString('en-IN')}
            </div>
            <p style={{ margin: 0, color: '#7a8c7c', fontSize: '11px' }}>
              Allocated to active savings goals. Not counted in spending balance.
            </p>
          </div>

          {/* 4. Locked Funds */}
          <div className="card allocation-card locked-card" style={{ padding: '16px', background: '#15161d', border: '1px solid #f59e0b', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '10px', color: '#fbbf24', fontWeight: 600, letterSpacing: '0.5px' }}>LOCKED FUNDS</span>
              <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '4px', color: '#fbbf24' }}>
                🔒 Protected
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#fbbf24', fontFamily: 'var(--font-mono, monospace)', margin: '4px 0' }}>
              ₹{lockedFundsTotal.toLocaleString('en-IN')}
            </div>
            <p style={{ margin: 0, color: '#9c9284', fontSize: '11px' }}>
              Parent-approved funds awaiting receipt confirmation. Cannot be spent or withdrawn.
            </p>
          </div>
        </div>
      </section>

      {/* Rewards Store Section */}
      {activeTab === 'store' && (
        <RewardsVault
          storeItems={storeItems}
          profile={profile}
          handlePurchase={handlePurchase}
          isSpending={isSpending}
          notify={notify}
        />
      )}

      {/* Transaction History / Ledger Section */}
      {activeTab === 'ledger' && (
        <section className="wallet-ledger-section">
          <div className="ledger-header-row">
            <div>
              <span className="section-kicker">TRANSACTION LEDGER</span>
              <h2>Verified Balance Ledger</h2>
            </div>
            <div className="ledger-search-box">
              <span>⌕</span>
              <input
                type="text"
                placeholder="Search transactions, reasons, references..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className="clear-search" onClick={() => setSearch('')}>
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Ledger Mode Selector (Financial Movements vs LOOT Coins) */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', borderBottom: '1px solid #233525', paddingBottom: '8px' }}>
            <button
              type="button"
              className={`filter-pill ${ledgerMode === 'financial' ? 'active' : ''}`}
              style={{ fontWeight: 600 }}
              onClick={() => {
                setLedgerMode('financial')
                setFinancialFilter('all')
              }}
            >
              💼 Financial Ledger (Cash & Goals)
              <span className="badge-count" style={{ marginLeft: '6px' }}>{financialTransactions.length}</span>
            </button>
            <button
              type="button"
              className={`filter-pill ${ledgerMode === 'coins' ? 'active' : ''}`}
              style={{ fontWeight: 600 }}
              onClick={() => {
                setLedgerMode('coins')
                setFilter('all')
              }}
            >
              ✦ LOOT Coin Rewards
              <span className="badge-count" style={{ marginLeft: '6px' }}>{transactions.length}</span>
            </button>
          </div>

          {/* Filter Pills for Active Mode */}
          <div className="ledger-filter-bar">
            {ledgerMode === 'financial' ? (
              financialFilterTabs.map(tab => (
                <button
                  key={tab.id}
                  className={`filter-pill ${financialFilter === tab.id ? 'active' : ''}`}
                  onClick={() => setFinancialFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))
            ) : (
              coinFilterTabs.map(tab => (
                <button
                  key={tab.id}
                  className={`filter-pill ${filter === tab.id ? 'active' : ''}`}
                  onClick={() => setFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))
            )}
          </div>

          {/* Ledger Table */}
          <div className="ledger-table-card card">
            {ledgerMode === 'financial' ? (
              filteredFinancialTransactions.length === 0 ? (
                <div className="empty-ledger">
                  <span className="empty-icon">💼</span>
                  <strong>No Financial Movements Found</strong>
                  <p>
                    {search
                      ? `No movements match “${search}”. Try clearing your search.`
                      : 'No financial transactions recorded in this category yet.'}
                  </p>
                  {(search || financialFilter !== 'all') && (
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setSearch('')
                        setFinancialFilter('all')
                      }}
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="ledger-list">
                  {filteredFinancialTransactions.map(tx => {
                    const rawType = (tx.type || '').toUpperCase()
                    const isContrib = rawType === 'GOAL_CONTRIBUTION'
                    const isWithdr = rawType === 'GOAL_WITHDRAWAL'
                    const isParentLocked = rawType === 'PARENT_APPROVAL_LOCKED'
                    const isParentUnlocked = rawType === 'PARENT_FUNDS_UNLOCKED'
                    const isParentExpired = rawType === 'PARENT_APPROVAL_EXPIRED'
                    const amt = Number(tx.amount) || 0
                    const isPositive = isWithdr || amt > 0
                    const isNegative = isContrib || amt < 0

                    const formattedDate = tx.timestamp
                      ? new Date(tx.timestamp).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : (tx.date || 'Recent')

                    const typeBadgeText = isContrib ? 'Goal Contribution'
                      : isWithdr ? 'Goal Withdrawal'
                      : isParentLocked ? 'Parent Locked'
                      : isParentUnlocked ? 'Parent Unlocked'
                      : isParentExpired ? 'Approval Expired'
                      : (amt < 0 ? 'Expense' : 'Money Added')

                    const badgeClass = isContrib ? 'contrib'
                      : isWithdr ? 'withdr'
                      : (isParentLocked || isParentExpired) ? 'locked'
                      : (amt < 0 ? 'expense' : 'income')

                    return (
                      <div
                        key={tx.id}
                        className="ledger-row"
                        title={tx.description || tx.title}
                      >
                        <div className="ledger-row-icon">
                          <span className={`tx-icon-circle ${badgeClass}`} style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            fontSize: '13px',
                            background: isContrib ? 'rgba(0, 229, 255, 0.15)' : isWithdr ? 'rgba(255, 77, 166, 0.15)' : isParentLocked ? 'rgba(245, 158, 11, 0.15)' : amt > 0 ? 'rgba(103, 255, 58, 0.15)' : 'rgba(255, 77, 166, 0.15)',
                            color: isContrib ? '#00e5ff' : isWithdr ? '#ff77bb' : isParentLocked ? '#fbbf24' : amt > 0 ? '#67ff3a' : '#ff77bb',
                            border: `1px solid ${isContrib ? '#00e5ff' : isWithdr ? '#ff77bb' : isParentLocked ? '#fbbf24' : amt > 0 ? '#67ff3a' : '#ff77bb'}`
                          }}>
                            {isContrib ? '🎯' : isWithdr ? '↺' : isParentLocked ? '🔒' : isParentUnlocked ? '🔓' : isParentExpired ? '⏱️' : (amt < 0 ? '↘' : '↗')}
                          </span>
                        </div>

                        <div className="ledger-row-info">
                          <div className="ledger-row-title-line" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <strong>{tx.title}</strong>
                            <span className={`category-tag ${badgeClass}`} style={{
                              fontSize: '9px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: 'rgba(255, 255, 255, 0.08)',
                              color: isContrib ? '#00e5ff' : isWithdr ? '#ff77bb' : isParentLocked ? '#fbbf24' : amt > 0 ? '#67ff3a' : '#ff77bb'
                            }}>
                              {typeBadgeText}
                            </span>
                            {tx.goalName && (
                              <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(0, 229, 255, 0.1)', color: '#00e5ff' }}>
                                🎯 {tx.goalName}
                              </span>
                            )}
                          </div>
                          <p className="ledger-row-desc">{tx.description || tx.title}</p>
                          <span className="ledger-row-date">{formattedDate}</span>
                        </div>

                        <div className="ledger-row-amount" style={{ textAlign: 'right' }}>
                          <span style={{
                            fontSize: '15px',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono, monospace)',
                            color: isContrib ? '#00e5ff' : isWithdr ? '#67ff3a' : isPositive ? '#67ff3a' : isNegative ? '#ff77bb' : '#fbbf24'
                          }}>
                            {isContrib ? `-₹${Math.abs(amt).toLocaleString('en-IN')}`
                              : isWithdr ? `+₹${Math.abs(amt).toLocaleString('en-IN')}`
                              : isParentLocked ? `₹${Math.abs(amt).toLocaleString('en-IN')}`
                              : `${amt > 0 ? '+' : '-'}₹${Math.abs(amt).toLocaleString('en-IN')}`}
                          </span>
                          <small className="balance-after-text" style={{ display: 'block', fontSize: '10px', color: '#8c9c8e' }}>
                            {isContrib ? 'Allocated to goal'
                              : isWithdr ? 'Returned to cash'
                              : isParentLocked ? 'Locked for pitch'
                              : (amt > 0 ? 'Cash inflow' : 'Cash outflow')}
                          </small>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : (
              filteredTransactions.length === 0 ? (
                <div className="empty-ledger">
                  <span className="empty-icon">◈</span>
                  <strong>No Transactions Found</strong>
                  <p>
                    {search
                      ? `No entries match “${search}”. Try clearing your search.`
                      : 'No coin operations recorded in this category yet.'}
                  </p>
                  {(search || filter !== 'all') && (
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setSearch('')
                        setFilter('all')
                      }}
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="ledger-list">
                  {filteredTransactions.map(tx => {
                    const isEarn = tx.type === 'earn'
                    const isSpend = tx.type === 'spend'
                    const formattedDate = tx.timestamp
                      ? new Date(tx.timestamp).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Recent'

                    return (
                      <div
                        key={tx.id}
                        className="ledger-row"
                        onClick={() => setSelectedTx(tx)}
                        title="Click to inspect transaction details"
                      >
                        <div className="ledger-row-icon">
                          <span className={`tx-icon-circle ${tx.type}`}>
                            {isEarn ? '↗' : isSpend ? '↘' : '↺'}
                          </span>
                        </div>

                        <div className="ledger-row-info">
                          <div className="ledger-row-title-line">
                            <strong>{tx.title}</strong>
                            <span className={`category-tag ${tx.category || 'general'}`}>
                              {tx.category || 'activity'}
                            </span>
                          </div>
                          <p className="ledger-row-desc">{tx.description}</p>
                          <span className="ledger-row-date">{formattedDate}</span>
                        </div>

                        <div className="ledger-row-amount">
                          <CoinBadge
                            amount={tx.amount}
                            prefix={isEarn ? '+' : isSpend ? '-' : '↺'}
                            size="md"
                            variant={isEarn ? 'lime' : isSpend ? 'pink' : 'yellow'}
                          />
                          <small className="balance-after-text">
                            bal: {Number(tx.balanceAfter || 0).toLocaleString('en-IN')}
                          </small>
                        </div>

                        <div className="ledger-row-action">
                          <button
                            className="inspect-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedTx(tx)
                            }}
                          >
                            Inspect ↗
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </div>
        </section>
      )}

      {/* Transaction Details Modal */}
      {selectedTx && (
        <TransactionModal
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
        />
      )}
    </div>
  )
}

export default WalletView
