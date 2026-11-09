import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import './App.css'
import LootCoin from './components/LootCoin'
import CoinBadge from './components/CoinBadge'
import WalletView from './components/WalletView'
import FirstTransactionCelebration from './components/FirstTransactionCelebration'
import LootLogo from './components/LootLogo'
import SplashScreen from './components/SplashScreen'
import CreateGoalCelebration from './components/CreateGoalCelebration'
import CoinFlyingEffect from './components/CoinFlyingEffect'
import LevelUpCelebration from './components/LevelUpCelebration'
import FirstSavingCelebration from './components/FirstSavingCelebration'
import SpendingBreakdownCard from './components/SpendingBreakdownCard'
import WeeklyBudgetCard from './components/WeeklyBudgetCard'
import {
  calculateWeeklyBudgetStats,
  isQualifyingExpense
} from './services/budgetService'
import MoneyLabEmptyState from './components/MoneyLabEmptyState'
import SplitBillsEmptyState from './components/SplitBillsEmptyState'
import SplitBillCard from './components/SplitBillCard'
import CreateSplitModal from './components/CreateSplitModal'
import SplitDetailsModal from './components/SplitDetailsModal'
import GoalsEmptyState from './components/GoalsEmptyState'
import AnimatedNumber from './components/AnimatedNumber'
import SavingsProgressRing from './components/SavingsProgressRing'
import WeeklyBillModal from './components/WeeklyBillModal'
import CustomizeProfileModal from './components/CustomizeProfileModal'
import WalletOnboardingModal from './components/WalletOnboardingModal'
import OverspendingConfirmModal from './components/OverspendingConfirmModal'
import OutstandingShortfallCard from './components/OutstandingShortfallCard'
import ShortfallsSection from './components/ShortfallsSection'
import PitchCelebration from './components/PitchCelebration'
import CrewPoolCelebration from './components/CrewPoolCelebration'
import ParentPortal from './components/parent/ParentPortal'
import ParentShareModal from './components/parent/ParentShareModal'
import SpendingImpactModal from './components/SpendingImpactModal'
import {
  calculateSavingsPace,
  calculateGoalEta,
  calculateSpendingImpact
} from './services/goalEtaService'
import SmartBuyView from './components/smartbuy/SmartBuyView'
import MrSpark from './components/mrspark/MrSpark'
import SparkTourSpotlight from './components/mrspark/SparkTourSpotlight'
import { useMrSpark } from './components/mrspark/useMrSpark'
import { resetSparkState, setSparkState, TUTORIAL_STATES } from './components/mrspark/sparkTutorial'
import { isDebugMode } from './utils/debug'
import {
  openMoneyDB,
  getCentralAccountingState,
  subscribeMoneyEngine,
  checkExpenseOverspend,
  recordTransaction,
  resetMoneyEngineForNewUser
} from './services/moneyEngine'
import {
  getSmartBuySavings,
  addSmartBuySavings,
  getRecentComparisons,
  saveComparisonToHistory,
  getSleepReminders,
  saveSleepReminder,
  dismissSleepReminder,
  recordComparisonForCoins
} from './services/smartBuyStorage'
import { playCoinSound, playLevelUpSound, playCelebrationSound, playPitchFanfareSound } from './utils/sfx'

const navItems = [
  ['Dashboard', '⌂'],
  ['Wallet', '◈'],
  ['Goals', '◎'],
  ['Money Lab', '✹'],
  ['Smart Buy', '⚡'],
  ['Loot Hub', '✦'],
  ['Ask Parent', '♡']
]

const emptyForms = {
  goal: { name: '', category: 'Lifestyle', target: '', deadline: '', link: '' },
  expense: { title: '', category: 'Lifestyle', amount: '' },
  split: { title: '', total: '', participants: '' },
  pool: { name: '', purpose: '', target: '', deadline: '', ownerTarget: '', members: '' },
  pitch: { amount: '', purpose: '', reason: '', chores: '', duration: '', message: '' },
  profile: { name: '', email: '', avatar: '', accent: 'lime', bio: '' }
}

const leaderboard = [
  { name: 'Maya Shah', rank: 'Vault King', score: 2480, coins: 1320, avatar: 'M', color: 'pink' },
  { name: 'Arjun Mehta', rank: 'Richie Rich', score: 2110, coins: 1080, avatar: 'A', color: 'cyan' },
  { name: 'Andy Joshi', rank: 'Richie Rich', score: 1070, coins: 1070, avatar: 'A', color: 'lime', current: true },
  { name: 'Zoya Khan', rank: 'Saving Rookie', score: 710, coins: 710, avatar: 'Z', color: 'purple' },
]

const api = async (path, options = {}) => {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Request failed')
  return data
}

const parseReceipt = (text) => {
  const dateMatch = text.match(/\b(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]20\d{2})\b/)
  const amountMatches = [...text.matchAll(/(?:₹|rs\.?|inr|total|amount|grand total)[\s:]*(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?)/gi)]
  const numbers = amountMatches.map(match => Number(match[1].replace(/[,\s]/g, ''))).filter(Boolean)
  const fallbackNumbers = [...text.matchAll(/\b\d{2,6}(?:\.\d{1,2})?\b/g)].map(match => Number(match[0])).filter(number => number > 10)
  const amount = numbers.at(-1) || Math.max(...fallbackNumbers, 0)
  const lines = text.split(/\n/).map(line => line.trim()).filter(line => line.length > 3)
  const title = lines.find(line => !/receipt|invoice|date|total|amount|thank|gst|tax/i.test(line)) || 'Scanned receipt'
  return { title: title.slice(0, 60), amount: amount ? String(amount) : '', date: dateMatch ? dateMatch[1].replace(/\./g, '-') : new Date().toISOString().slice(0, 10), category: 'Essentials' }
}

function App() {
  const parentToken = useMemo(() => {
    if (typeof window !== 'undefined' && window.location) {
      const path = window.location.pathname || ''
      if (path.startsWith('/parent/')) {
        return path.replace('/parent/', '').split('/')[0].split('?')[0]
      }
    }
    return null
  }, [])

  const [state, setState] = useState(null)
  const [activePage, setActivePage] = useState(() => {
    if (typeof window !== 'undefined' && window.location) {
      const path = (window.location.pathname || '').toLowerCase()
      if (path === '/smart-buy' || path === '/smartbuy') return 'Smart Buy'
      if (path === '/wallet') return 'Wallet'
      if (path === '/goals') return 'Goals'
      if (path === '/money-lab' || path === '/moneylab') return 'Money Lab'
      if (path === '/loot-hub' || path === '/loothub') return 'Loot Hub'
      if (path === '/ask-parent' || path === '/askparent') return 'Ask Parent'
    }
    return 'Dashboard'
  })
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForms)
  const [toast, setToast] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [signedIn, setSignedIn] = useState(true)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [firstTxCelebration, setFirstTxCelebration] = useState(null)
  const [goalCreatedCelebration, setGoalCreatedCelebration] = useState(null)
  const [pitchCelebration, setPitchCelebration] = useState(null)
  const [crewPoolCelebration, setCrewPoolCelebration] = useState(null)
  const [selectedSplitForDetails, setSelectedSplitForDetails] = useState(null)
  const [shareModalPitch, setShareModalPitch] = useState(null)
  const [firstSavingCelebration, setFirstSavingCelebration] = useState(null)
  const [levelUpCelebration, setLevelUpCelebration] = useState(null)
  const [coinBursts, setCoinBursts] = useState([])
  const [sfxMuted, setSfxMuted] = useState(false)
  const [splashPreview, setSplashPreview] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [smartBuySavings, setSmartBuySavings] = useState(() => getSmartBuySavings())
  const [recentComparisons, setRecentComparisons] = useState(() => getRecentComparisons())
  const [sleepReminders, setSleepReminders] = useState(() => getSleepReminders())
  const [accountingState, setAccountingState] = useState({
    openingBalance: 0,
    onboardingCompleted: false,
    availableBalance: 0,
    outstandingShortfall: 0,
    totalShortfallOriginal: 0,
    totalShortfallSettled: 0,
    transactions: [],
    shortfalls: [],
    loans: []
  })
  const [pendingOverspendExpense, setPendingOverspendExpense] = useState(null)
  const [splashFinished, setSplashFinished] = useState(() => {
    if (typeof window === 'undefined') return true
    return Boolean(sessionStorage.getItem('loot_splash_shown'))
  })
  const [expenseModalTab, setExpenseModalTab] = useState('expense') // 'expense' | 'income'
  const [spendingImpact, setSpendingImpact] = useState(null)
  const [pendingSpendingImpact, setPendingSpendingImpact] = useState(null)
  const [highlightedGoalId, setHighlightedGoalId] = useState(null)
  const prevCoinsRef = useRef(null)

  const maturedSleepReminders = useMemo(() => {
    return sleepReminders.filter(
      r => !r.dismissed && Date.now() - (r.timestamp || 0) >= 24 * 60 * 60 * 1000
    )
  }, [sleepReminders])

  // Mr. Spark Interactive Product Guide & Walkthrough Hook
  const spark = useMrSpark({
    profile: state?.profile,
    activePage,
    setActivePage,
    isBalanceOnboardingDone: Boolean(accountingState?.onboardingCompleted),
    isDashboardReady: Boolean(!loading && state && splashFinished),
    setModal
  })

  const notify = useCallback((message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }, [])

  const triggerCoinEarn = useCallback((clientX, clientY, count = 6) => {
    playCoinSound(sfxMuted)
    setCoinBursts(prev => [
      ...prev.slice(-3),
      {
        id: Math.random().toString(36).slice(2, 9),
        startX: clientX || window.innerWidth / 2,
        startY: clientY || window.innerHeight / 2,
        count
      }
    ])
  }, [sfxMuted])

  const refresh = useCallback(async () => {
    try {
      const data = await api('/api/state')
      setState({
        ...data,
        pools: Array.isArray(data.pools) ? data.pools : [],
        splits: Array.isArray(data.splits) ? data.splits : [],
        coinTransactions: Array.isArray(data.coinTransactions) ? data.coinTransactions : []
      })

      // Level up detection
      const newCoins = data.profile?.coins || 0
      if (prevCoinsRef.current !== null && newCoins >= 500 && prevCoinsRef.current < 500) {
        playLevelUpSound(sfxMuted)
        setLevelUpCelebration({
          level: 2,
          rank: data.profile.rank || 'Cash Commander'
        })
      }
      prevCoinsRef.current = newCoins
    } catch (error) {
      notify(error.message)
    } finally {
      setLoading(false)
    }
  }, [notify, sfxMuted])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Initialize and synchronize with Central Money Engine (IndexedDB)
  useEffect(() => {
    let isSubscribed = true

    openMoneyDB()
      .then(() => getCentralAccountingState())
      .then((initial) => {
        if (isSubscribed && initial) {
          setAccountingState(initial)
        }
      })
      .catch((err) => {
        console.warn('Central money engine initialization error:', err)
      })

    const unsubscribe = subscribeMoneyEngine((updated) => {
      if (isSubscribed && updated) {
        setAccountingState(updated)
      }
    })

    return () => {
      isSubscribed = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.playFirstTransactionCelebration = (customTx) => {
        playCelebrationSound(sfxMuted)
        setFirstTxCelebration(customTx || {
          title: 'Coffee & snack',
          amount: -180,
          category: 'Lifestyle'
        })
      }
      window.playGoalCelebration = (customGoal) => {
        playCelebrationSound(sfxMuted)
        setGoalCreatedCelebration(customGoal || {
          name: 'Demo Gaming Setup',
          target: 2000,
          category: 'Lifestyle'
        })
      }
      window.playPitchCelebration = (customPitch) => {
        playPitchFanfareSound(true, sfxMuted)
        setPitchCelebration(customPitch || {
          amount: 2500,
          purpose: 'Demo Gaming Headset',
          reason: 'Better focus during online study sessions and gaming with friends.',
          chores: 'Clean room, Wash car, Walk dog',
          duration: '1 week',
          tasks: [
            { title: 'Clean room every day', duration: '1 week', status: 'proposed' },
            { title: 'Wash car on Saturday', duration: '1 hour', status: 'proposed' }
          ]
        })
      }
      window.playCrewPoolCelebration = (customPool) => {
        playCelebrationSound(sfxMuted)
        setCrewPoolCelebration(customPool || {
          name: 'Goa Trip Crew',
          target: 10000,
          purpose: 'Shared weekend trip',
          members: [
            { name: 'Andy', target: 2500 },
            { name: 'Priya', target: 2500 },
            { name: 'Kabir', target: 2500 },
            { name: 'Dev', target: 2500 }
          ]
        })
      }
      window.playFirstSavingCelebration = (goal, amount) => {
        playCelebrationSound(sfxMuted)
        setFirstSavingCelebration({
          goal: goal || { name: 'Demo Gaming Setup', target: 2000 },
          amount: amount || 250,
          coinsEarned: 5
        })
      }
      window.playLevelUp = (lvl, rnk) => {
        playLevelUpSound(sfxMuted)
        setLevelUpCelebration({
          level: lvl || 2,
          rank: rnk || 'Cash Commander'
        })
      }
      window.triggerCoins = (count) => {
        triggerCoinEarn(window.innerWidth / 2, window.innerHeight / 2, count || 6)
      }
      window.resetFirstTransactionFlag = () => {
        localStorage.removeItem('loot_first_transaction_inserted')
        notify('First transaction flag reset! Next logged spend will trigger celebration.')
      }
      window.resetFirstSavingFlag = () => {
        localStorage.removeItem('loot_first_saving_contributed')
        notify('First saving flag reset! Next contribution will trigger celebration.')
      }
      window.addTestSleepReminder = (hoursAgo = 25) => {
        const testItem = {
          item: 'Sony WH-1000XM5 Headphones',
          price: 24990,
          highestPrice: 29990,
          savings: 5000,
          store: 'Croma',
          url: 'https://www.croma.com',
          timestamp: Date.now() - (hoursAgo * 3600 * 1000),
          dismissed: false
        }
        const updated = saveSleepReminder(testItem)
        setSleepReminders(updated)
        notify(`Added test sleep reminder (${hoursAgo}h old). Check Dashboard for impulse nudge!`)
      }
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.playFirstTransactionCelebration
        delete window.playGoalCelebration
        delete window.playPitchCelebration
        delete window.playCrewPoolCelebration
        delete window.playFirstSavingCelebration
        delete window.playLevelUp
        delete window.triggerCoins
        delete window.resetFirstTransactionFlag
        delete window.resetFirstSavingFlag
        delete window.addTestSleepReminder
      }
    }
  }, [notify, triggerCoinEarn, sfxMuted])

  // Synchronize URL path with activePage
  useEffect(() => {
    if (typeof window !== 'undefined' && window.history && window.location) {
      const slugMap = {
        Dashboard: '/',
        Wallet: '/wallet',
        Goals: '/goals',
        'Money Lab': '/money-lab',
        'Smart Buy': '/smart-buy',
        'Loot Hub': '/loot-hub',
        'Ask Parent': '/ask-parent'
      }
      const targetPath = slugMap[activePage] || '/'
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ page: activePage }, '', targetPath)
      }
    }
  }, [activePage])

  // Browser back/forward navigation support
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePopState = (e) => {
      if (e.state?.page) {
        setActivePage(e.state.page)
      } else if (window.location) {
        const path = (window.location.pathname || '').toLowerCase()
        if (path === '/smart-buy' || path === '/smartbuy') setActivePage('Smart Buy')
        else if (path === '/wallet') setActivePage('Wallet')
        else if (path === '/goals') setActivePage('Goals')
        else if (path === '/money-lab' || path === '/moneylab') setActivePage('Money Lab')
        else if (path === '/loot-hub' || path === '/loothub') setActivePage('Loot Hub')
        else if (path === '/ask-parent' || path === '/askparent') setActivePage('Ask Parent')
        else setActivePage('Dashboard')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const handleDismissReminder = useCallback((idOrItem) => {
    const updated = dismissSleepReminder(idOrItem)
    setSleepReminders(updated)
    notify('Impulse resisted! Great financial discipline.')
  }, [notify])

  const handleSmartBuySaveGoal = useCallback((dealData) => {
    if (!dealData) return
    const bestPrice = Number(dealData.price) || 0
    const highestPrice = Number(dealData.highestPrice) || bestPrice
    const savings = Number(dealData.savings) || Math.max(0, highestPrice - bestPrice)

    if (savings > 0) {
      const newTotal = addSmartBuySavings(savings)
      setSmartBuySavings(newTotal)
    }

    setForm(current => ({
      ...current,
      goal: {
        ...current.goal,
        name: dealData.item || 'New Goal',
        target: bestPrice ? String(bestPrice) : '',
        category: 'Lifestyle',
        deadline: '',
        link: dealData.url || ''
      }
    }))
    setModal('goal')
    notify(`Prefilled savings goal for "${dealData.item}" (₹${bestPrice.toLocaleString('en-IN')})!`)

    if (dealData.id) {
      const updated = dismissSleepReminder(dealData.id)
      setSleepReminders(updated)
    }
  }, [notify])

  const handleSmartBuyAskParent = useCallback((dealData) => {
    if (!dealData) return
    const bestPrice = Number(dealData.price) || 0
    const storeInfo = dealData.store ? ` on ${dealData.store}` : ''
    const savingsInfo = dealData.savings ? ` (saved ₹${Number(dealData.savings).toLocaleString('en-IN')})` : ''
    const linkInfo = dealData.url ? `\n\nStore deal link: ${dealData.url}` : ''

    setForm(current => ({
      ...current,
      pitch: {
        ...current.pitch,
        amount: bestPrice ? String(bestPrice) : '',
        purpose: dealData.item || 'Purchase',
        reason: `Found verified best deal${storeInfo}${savingsInfo} using Smart Buy!${linkInfo}`,
        chores: 'Clean room, Wash dishes, Keep study desk organized',
        duration: '1 week',
        message: `Hey! I compared prices and found the best deal on ${dealData.store || 'store'} for ₹${bestPrice.toLocaleString('en-IN')}. I can help out with chores to cover it!`
      }
    }))
    setModal('pitch')
    notify(`Prefilled parent pitch for "${dealData.item}"!`)

    if (dealData.id) {
      const updated = dismissSleepReminder(dealData.id)
      setSleepReminders(updated)
    }
  }, [notify])

  const handleSmartBuySleepOnIt = useCallback((dealData) => {
    if (!dealData) return
    const bestPrice = Number(dealData.price) || 0
    const highestPrice = Number(dealData.highestPrice) || bestPrice
    const savings = Number(dealData.savings) || Math.max(0, highestPrice - bestPrice)

    if (savings > 0) {
      const newTotal = addSmartBuySavings(savings)
      setSmartBuySavings(newTotal)
    }

    const updated = saveSleepReminder(dealData)
    setSleepReminders(updated)
    notify(`24-hour sleep reminder set for "${dealData.item}"! Check back tomorrow to beat the impulse.`)
  }, [notify])

  const handleSmartBuyComparisonCompleted = useCallback(async (data) => {
    if (!data) return
    const itemName = data.targetIdentity?.cleanTitle || data.query || 'Product'
    const lowestOffer = data.comparison?.lowestOffer || {}
    const savings = data.comparison?.potentialSavings || 0

    // 1. Save to history (capped at 10 items)
    const updatedHistory = saveComparisonToHistory({
      item: itemName,
      price: lowestOffer.price || 0,
      store: lowestOffer.retailer || 'Best Store',
      url: lowestOffer.url || '',
      savings,
      searchData: data
    })
    setRecentComparisons(updatedHistory)

    // 2. Track comparison counts and award coins via named constants
    const result = recordComparisonForCoins()
    if (result.awardedCoins > 0) {
      triggerCoinEarn(window.innerWidth / 2, window.innerHeight / 2, 4)
      notify(`Price comparison logged! Earned +${result.awardedCoins} LOOT Coins!`)
    }
    if (result.unlockedBadge) {
      notify('Achievement Unlocked: Smart Shopper! 🛍️ (+15 ✦)')
    }

    // 3. Synchronize with server
    try {
      await api('/api/comparisons/record', {
        method: 'POST',
        body: JSON.stringify({
          item: itemName,
          price: lowestOffer.price || 0,
          savings
        })
      })
      await refresh()
    } catch {
      // Safe offline fallback
    }
  }, [notify, triggerCoinEarn, refresh])

  const handleSelectRecentComparison = useCallback(() => {
    setActivePage('Smart Buy')
  }, [])

  const handleReceiptResult = (text) => {
    const parsed = parseReceipt(text)
    setForm(current => ({ ...current, expense: { ...current.expense, ...parsed } }))
    setReceiptOpen(false)
    setModal('expense')
    notify(parsed.amount ? `Receipt read — ₹${Number(parsed.amount).toLocaleString('en-IN')} found. Review before saving.` : 'Receipt read — review the details before saving.')
  }

  const updateForm = (kind, key, value) => setForm(current => ({ ...current, [kind]: { ...current[kind], [key]: value } }))
  const closeModal = () => { setModal(null); setForm(emptyForms) }
  const request = async (work, success) => {
    try { await work(); await refresh(); closeModal(); notify(success) } catch (error) { notify(error.message) }
  }

  const addGoal = async (event) => {
    event.preventDefault()
    const goalData = { ...form.goal }
    try {
      const savedGoal = await api('/api/goals', {
        method: 'POST',
        body: JSON.stringify(goalData)
      })
      await refresh()
      closeModal()
      triggerCoinEarn(window.innerWidth / 2, window.innerHeight / 2, 8)
      playCelebrationSound(sfxMuted)
      notify('Goal created — earned +10 LOOT Coins!')
      setGoalCreatedCelebration(savedGoal || goalData)
    } catch (error) {
      notify(error.message)
    }
  }

  const handleEditGoal = async (goalId, event) => {
    if (event) event.preventDefault()
    const goalData = {
      name: form.goal.name?.trim(),
      target: Number(form.goal.target),
      category: form.goal.category || 'Lifestyle',
      deadline: form.goal.deadline || null,
      weeklySavingsPace: Number(form.goal.weeklySavingsPace) || 0
    }
    if (!goalData.name) return notify('Goal name cannot be empty')
    if (!goalData.target || isNaN(goalData.target) || goalData.target <= 0) {
      return notify('Target amount must be greater than 0')
    }

    try {
      await api(`/api/goals/${goalId}`, {
        method: 'PATCH',
        body: JSON.stringify(goalData)
      })
      await refresh()
      closeModal()
      notify('Goal updated successfully!')
    } catch (error) {
      notify(error.message)
    }
  }

  const handleDeleteGoal = async (goalId) => {
    const targetGoal = state?.goals?.find(g => String(g.id) === String(goalId))
    if (!targetGoal) return notify('Goal not found.')

    const confirmMsg = targetGoal.saved > 0
      ? `Delete "${targetGoal.name}"? ₹${targetGoal.saved.toLocaleString('en-IN')} of saved funds will be returned to your available cash.`
      : `Delete "${targetGoal.name}"?`

    if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) {
      return
    }

    try {
      if (targetGoal.saved > 0) {
        await recordTransaction({
          type: 'GOAL_WITHDRAWAL',
          goalId: String(targetGoal.id),
          goalName: targetGoal.name,
          amount: targetGoal.saved,
          title: `Goal Closed: ${targetGoal.name}`,
          description: `Goal "${targetGoal.name}" deleted. ₹${targetGoal.saved.toLocaleString('en-IN')} returned to available balance.`,
          category: 'Goals',
          userId: state?.profile?.email || 'rookie@example.com',
          icon: '↺',
          isGoalWithdrawal: true
        })
      }

      await api(`/api/goals/${goalId}`, { method: 'DELETE' })
      await refresh()
      notify(`Goal "${targetGoal.name}" deleted successfully.`)
    } catch (error) {
      notify(error.message)
    }
  }

  const executeExpense = async (expenseData, isOverspend = false) => {
    const hasLoggedFirstTx = typeof window !== 'undefined' && localStorage.getItem('loot_first_transaction_inserted') === 'true'
    const isFirstInsert = !hasLoggedFirstTx || (state?.transactions?.length === 0)

    try {
      // 1. Record transaction in Central Money Engine (updates balance, shortfalls, audit ledger)
      const recordResult = await recordTransaction({
        title: expenseData.title,
        category: expenseData.category || 'Lifestyle',
        amount: expenseData.amount,
        isOverspend,
        date: new Date().toISOString().slice(0, 10),
        icon: '↘'
      })

      // 2. Synchronize to server API
      let savedTx = null
      try {
        savedTx = await api('/api/transactions', {
          method: 'POST',
          body: JSON.stringify({
            ...expenseData,
            id: recordResult?.transaction?.id,
            timestamp: recordResult?.transaction?.timestamp
          })
        })
      } catch {
        // Safe offline fallback
      }

      await refresh()
      closeModal()
      setPendingOverspendExpense(null)

      if (isOverspend) {
        playCelebrationSound(sfxMuted)
        triggerCoinEarn(window.innerWidth / 2, window.innerHeight / 2, 2)
        notify(`Whoa! Expense lodged with ₹${recordResult?.shortfall?.remainingAmount || 0} shortfall.`)
      } else {
        triggerCoinEarn(window.innerWidth / 2, window.innerHeight / 2, 4)
        playCelebrationSound(sfxMuted)
        notify('Expense logged — earned +2 LOOT Coins!')
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('loot_first_transaction_inserted', 'true')
      }

      // Compute immediate Spending Impact using latest persisted goals
      const impact = savedTx?.spendingImpact || calculateSpendingImpact(expenseData, state?.goals || [], {
        parentRequests: state?.parentRequests || [],
        accountingState: recordResult
      })

      if (isFirstInsert) {
        setFirstTxCelebration({
          ...(savedTx || expenseData),
          isFirst: isFirstInsert
        })
        setPendingSpendingImpact(impact)
      } else {
        setSpendingImpact(impact)
      }
    } catch (error) {
      notify(error.message)
    }
  }

  const handleWithdraw = async (goalId, amount) => {
    const numAmount = Math.max(0, Number(amount))
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      return notify('Please enter a valid withdrawal amount.')
    }
    const targetGoal = state?.goals?.find(g => String(g.id) === String(goalId))
    if (!targetGoal) return notify('Goal not found.')
    if (targetGoal.saved < numAmount) {
      return notify(`Cannot withdraw ₹${numAmount.toLocaleString('en-IN')}; current savings are ₹${targetGoal.saved.toLocaleString('en-IN')}.`)
    }

    try {
      // 1. Record in central money engine as GOAL_WITHDRAWAL (NOT treated as income!)
      const recordResult = await recordTransaction({
        type: 'GOAL_WITHDRAWAL',
        goalId: String(targetGoal.id),
        goalName: targetGoal.name,
        amount: numAmount,
        title: `Withdrew from ${targetGoal.name}`,
        description: `Withdrew ₹${numAmount.toLocaleString('en-IN')} from ${targetGoal.name} goal.`,
        category: 'Goals',
        userId: state?.profile?.email || 'rookie@example.com',
        icon: '↺'
      })

      // 2. Call backend
      await api(`/api/goals/${goalId}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({
          amount: numAmount,
          txId: recordResult?.transaction?.id,
          timestamp: recordResult?.transaction?.timestamp
        })
      })

      await refresh()
      closeModal()
      notify(`Withdrew ₹${numAmount.toLocaleString('en-IN')} from ${targetGoal.name} into available balance.`)
    } catch (err) {
      notify(err.message)
    }
  }

  const addExpense = async (event) => {
    if (event) event.preventDefault()
    const requestedAmt = Math.abs(Number(form.expense.amount))
    if (!requestedAmt || isNaN(requestedAmt) || requestedAmt <= 0) {
      return notify('Please enter a valid expense amount')
    }

    const expenseData = {
      ...form.expense,
      amount: -requestedAmt,
      title: form.expense.title || 'Expense'
    }

    // Check if expense exceeds available balance
    const overspendCheck = await checkExpenseOverspend(requestedAmt)
    if (overspendCheck.isOverspend) {
      setPendingOverspendExpense({
        expenseData,
        availableBalance: overspendCheck.availableBalance,
        requestedAmount: overspendCheck.requestedAmount,
        shortfallAmount: overspendCheck.shortfallAmount
      })
      return
    }

    await executeExpense(expenseData, false)
  }

  const addIncome = async (event) => {
    if (event) event.preventDefault()
    const incomeAmt = Math.abs(Number(form.expense.amount))
    if (!incomeAmt || isNaN(incomeAmt) || incomeAmt <= 0) {
      return notify('Please enter a valid amount')
    }

    const incomeData = {
      title: form.expense.title || 'Money Added',
      category: form.expense.category || 'Income',
      amount: incomeAmt
    }

    try {
      const recordResult = await recordTransaction({
        title: incomeData.title,
        category: incomeData.category,
        amount: incomeAmt,
        date: new Date().toISOString().slice(0, 10),
        icon: '↗'
      })

      try {
        await api('/api/transactions', {
          method: 'POST',
          body: JSON.stringify({
            ...incomeData,
            id: recordResult?.transaction?.id,
            timestamp: recordResult?.transaction?.timestamp
          })
        })
      } catch {
        // Safe offline fallback
      }

      await refresh()
      closeModal()
      triggerCoinEarn(window.innerWidth / 2, window.innerHeight / 2, 6)
      playCelebrationSound(sfxMuted)

      if (recordResult.settlementAllocations && recordResult.settlementAllocations.length > 0) {
        const totalSettled = recordResult.settlementAllocations.reduce((s, a) => s + a.amount, 0)
        notify(`Money received! Auto-settled ₹${totalSettled.toLocaleString('en-IN')} towards shortfalls.`)
      } else {
        notify(`₹${incomeAmt.toLocaleString('en-IN')} added to available balance!`)
      }
    } catch (err) {
      notify(err.message)
    }
  }

  const handleCreateSplit = async (payload) => {
    try {
      const created = await api('/api/splits', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      setState(prev => prev ? {
        ...prev,
        splits: [created, ...(prev.splits || [])]
      } : prev)
      setModal(null)
      notify(`Split bill "${payload.title}" created! Settle with your crew to earn +25 coins.`)
    } catch (err) {
      notify(err.message || 'Failed to create split bill')
    }
  }

  const handleToggleParticipantPaid = async (splitId, participantIndex, paid) => {
    try {
      const updated = await api(`/api/splits/${splitId}`, {
        method: 'PATCH',
        body: JSON.stringify({ participant: participantIndex, paid })
      })

      setState(prev => {
        if (!prev) return prev
        const updatedSplits = (prev.splits || []).map(s => String(s.id) === String(updated.id) ? updated : s)
        const newCoins = updated.coinsAwarded ? (prev.profile?.coins || 0) + updated.coinsAwarded : (prev.profile?.coins || 0)
        return {
          ...prev,
          splits: updatedSplits,
          profile: {
            ...prev.profile,
            coins: newCoins
          }
        }
      })

      if (updated.coinsAwarded > 0 || updated.isNewlySettled) {
        triggerCoinEarn(window.innerWidth / 2, window.innerHeight / 2, updated.coinsAwarded || 25)
        notify(`🎉 Bill settled! You're a Smart Spender. Earned +${updated.coinsAwarded || 25} LOOT Coins!`)
      } else {
        notify('Payment recorded successfully.')
      }

      setSelectedSplitForDetails(prev => (prev && String(prev.id) === String(updated.id) ? updated : prev))
      return updated
    } catch (err) {
      notify(err.message || 'Failed to update payment status')
      throw err
    }
  }

  const handleSettleAll = async (splitId) => {
    try {
      const updated = await api(`/api/splits/${splitId}/settle`, {
        method: 'POST'
      })

      setState(prev => {
        if (!prev) return prev
        const updatedSplits = (prev.splits || []).map(s => String(s.id) === String(updated.id) ? updated : s)
        const newCoins = updated.coinsAwarded ? (prev.profile?.coins || 0) + updated.coinsAwarded : (prev.profile?.coins || 0)
        return {
          ...prev,
          splits: updatedSplits,
          profile: {
            ...prev.profile,
            coins: newCoins
          }
        }
      })

      if (updated.coinsAwarded > 0 || updated.isNewlySettled) {
        triggerCoinEarn(window.innerWidth / 2, window.innerHeight / 2, updated.coinsAwarded || 25)
        notify(`🎉 Bill settled! You're a Smart Spender. Earned +${updated.coinsAwarded || 25} LOOT Coins!`)
      }

      setSelectedSplitForDetails(prev => (prev && String(prev.id) === String(updated.id) ? updated : prev))
      return updated
    } catch (err) {
      notify(err.message || 'Failed to settle all participants')
      throw err
    }
  }

  const handleDeleteSplit = async (splitId) => {
    try {
      await api(`/api/splits/${splitId}`, { method: 'DELETE' })
      setState(prev => prev ? {
        ...prev,
        splits: (prev.splits || []).filter(s => String(s.id) !== String(splitId))
      } : prev)
      if (selectedSplitForDetails && String(selectedSplitForDetails.id) === String(splitId)) {
        setSelectedSplitForDetails(null)
      }
      notify('Split bill deleted.')
    } catch (err) {
      notify(err.message || 'Failed to delete split bill')
    }
  }

  const addSplit = (event) => {
    event?.preventDefault?.()
    const participants = (form.split.participants || '').split(',').map(name => name.trim()).filter(Boolean)
    handleCreateSplit({
      title: form.split.title,
      total: Number(form.split.total),
      mode: 'equal',
      participants
    })
  }

  const addContribution = async (goalId, amount) => {
    const numAmount = Math.max(0, Number(amount))
    if (!numAmount || numAmount < 1) return notify('Enter a valid contribution amount.')

    if (accountingState.availableBalance < numAmount) {
      return notify(`Cannot contribute ₹${numAmount.toLocaleString('en-IN')}; available balance is only ₹${accountingState.availableBalance.toLocaleString('en-IN')}.`)
    }

    const coinsEarned = Math.max(1, Math.round(numAmount / 50))
    const isFirstSaving = typeof window !== 'undefined' && !localStorage.getItem('loot_first_saving_contributed')

    try {
      const targetGoal = state?.goals?.find(g => String(g.id) === String(goalId))

      // 1. Record in central money engine with type GOAL_CONTRIBUTION (deducts from available cash)
      const recordResult = await recordTransaction({
        type: 'GOAL_CONTRIBUTION',
        goalId: String(goalId),
        goalName: targetGoal?.name || 'Goal',
        amount: numAmount,
        title: `Added ₹${numAmount.toLocaleString('en-IN')} to ${targetGoal?.name || 'goal'}`,
        description: `Added ₹${numAmount.toLocaleString('en-IN')} to ${targetGoal?.name || 'goal'} goal.`,
        category: 'Goals',
        userId: state?.profile?.email || 'rookie@example.com',
        icon: '🎯'
      })

      // 2. Call backend
      await api(`/api/goals/${goalId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          contribution: numAmount,
          txId: recordResult?.transaction?.id,
          timestamp: recordResult?.transaction?.timestamp
        })
      })

      await refresh()
      closeModal()
      triggerCoinEarn(window.innerWidth / 2, window.innerHeight / 2, Math.min(8, coinsEarned))
      notify(`Saved ₹${numAmount.toLocaleString('en-IN')} — earned +${coinsEarned} LOOT Coins!`)

      if (isFirstSaving) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('loot_first_saving_contributed', 'true')
        }
        playCelebrationSound(sfxMuted)
        setFirstSavingCelebration({
          goal: targetGoal || { name: 'Savings Mission', target: 500 },
          amount: numAmount,
          coinsEarned
        })
      }
    } catch (error) {
      notify(error.message)
    }
  }

  const addPool = async (event) => {
    event.preventDefault()
    const members = form.pool.members.split(',').map(name => ({ name: name.trim(), target: 0 })).filter(member => member.name)
    const poolData = {
      ...form.pool,
      target: Number(form.pool.target),
      ownerTarget: Number(form.pool.ownerTarget),
      members
    }
    try {
      const savedPool = await api('/api/pools', {
        method: 'POST',
        body: JSON.stringify(poolData)
      })
      await refresh()
      closeModal()
      triggerCoinEarn(window.innerWidth / 2, window.innerHeight / 2, 8)
      playCelebrationSound(sfxMuted)
      setCrewPoolCelebration(savedPool || poolData)
      notify('Pool created — earned +10 LOOT Coins!')
    } catch (error) {
      notify(error.message)
    }
  }

  const saveProfile = (event) => {
    event.preventDefault()
    const updatedProfile = { ...state.profile, ...form.profile, ...Object.fromEntries(Object.entries(form.profile).filter(([, value]) => value !== '')) }
    request(() => api('/api/profile', { method: 'PATCH', body: JSON.stringify(updatedProfile) }), 'Profile customized and saved locally.')
  }

  const switchExperienceMode = async (mode) => {
    try {
      try {
        await api('/api/profile/experience-mode', {
          method: 'POST',
          body: JSON.stringify({ mode })
        })
      } catch (err) {
        // Fallback for when backend process has not yet restarted with new routes
        if (err.message && err.message.toLowerCase().includes('not found')) {
          if (mode === 'new_user') {
            if (state?.goals?.length) {
              await Promise.allSettled(state.goals.map(g => api(`/api/goals/${g.id}`, { method: 'DELETE' })))
            }
            if (state?.transactions?.length) {
              await Promise.allSettled(state.transactions.map(t => api(`/api/transactions/${t.id}`, { method: 'DELETE' })))
            }
            await api('/api/profile', {
              method: 'PATCH',
              body: JSON.stringify({
                name: 'Rookie Saver',
                email: 'rookie@example.com',
                rank: 'Saving Rookie',
                coins: 0,
                streak: 0,
                avatar: 'R',
                accent: 'lime',
                bio: 'Building financial discipline from scratch.',
                experienceMode: 'new_user'
              })
            })
          } else {
            await api('/api/profile', {
              method: 'PATCH',
              body: JSON.stringify({
                name: 'Andy Joshi',
                email: 'andy@example.com',
                avatar: 'A',
                accent: 'lime',
                bio: 'Saving for something big.',
                experienceMode: 'test_user'
              })
            })
            if (!state?.goals?.length) {
              await api('/api/goals', { method: 'POST', body: JSON.stringify({ name: 'Gaming Setup', category: 'Lifestyle', target: 2000 }) })
              await api('/api/goals', { method: 'POST', body: JSON.stringify({ name: 'Emergency Fund', category: 'Essentials', target: 1500 }) })
              await api('/api/goals', { method: 'POST', body: JSON.stringify({ name: 'Weekend Trip', category: 'Experiences', target: 800 }) })
            }
            if (!state?.transactions?.length) {
              await api('/api/transactions', { method: 'POST', body: JSON.stringify({ title: 'Coffee & snack', amount: -180, category: 'Lifestyle' }) })
              await api('/api/transactions', { method: 'POST', body: JSON.stringify({ title: 'Pocket money', amount: 2500, category: 'Income' }) })
              await api('/api/transactions', { method: 'POST', body: JSON.stringify({ title: 'Metro ride', amount: -90, category: 'Essentials' }) })
              await api('/api/transactions', { method: 'POST', body: JSON.stringify({ title: 'Movie night', amount: -420, category: 'Impulse' }) })
            }
          }
        } else {
          throw err
        }
      }

      if (mode === 'new_user') {
        await resetMoneyEngineForNewUser(0)
        if (typeof window !== 'undefined') {
          localStorage.removeItem('loot_first_transaction_inserted')
          localStorage.setItem('loot_user_mode', 'new_user')
          resetSparkState('rookie@example.com')
          resetSparkState('Rookie Saver')
          resetSparkState(state?.profile?.email)
        }
        notify('Switched to Rookie Journey (New User Experience)! Clean slate ready.')
      } else {
        await resetMoneyEngineForNewUser(500)
        if (typeof window !== 'undefined') {
          localStorage.setItem('loot_first_transaction_inserted', 'true')
          localStorage.setItem('loot_user_mode', 'test_user')
          setSparkState('andy@example.com', TUTORIAL_STATES.TUTORIAL_COMPLETED)
        }
        notify('Switched to Loaded Vault (Test User Experience)! Demo data restored.')
      }
      await refresh()
      closeModal()
    } catch (err) {
      notify(err.message)
    }
  }

  const addPitch = async (event) => {
    event.preventDefault()
    const tasks = form.pitch.chores.split(',').map(title => ({ title: title.trim(), duration: form.pitch.duration, status: 'proposed' })).filter(task => task.title)
    const pitchData = {
      ...form.pitch,
      amount: Number(form.pitch.amount),
      tasks
    }
    try {
      const savedPitch = await api('/api/pitches', { method: 'POST', body: JSON.stringify(pitchData) })
      await refresh()
      closeModal()
      triggerCoinEarn(window.innerWidth / 2, window.innerHeight / 2, 5)
      playPitchFanfareSound(true, sfxMuted)
      notify('Pitch created — earned +5 LOOT Coins!')
      setPitchCelebration(savedPitch || pitchData)
      setShareModalPitch(savedPitch || pitchData)
    } catch (error) {
      notify(error.message)
    }
  }

  const handleRevokePitch = async (pitch) => {
    if (!window.confirm(`Are you sure you want to cancel and revoke the parent link for "${pitch.purpose}"?`)) return
    try {
      if (pitch.parentRequestId) {
        await api(`/api/parent-requests/${pitch.parentRequestId}/revoke`, { method: 'POST' })
      } else {
        await api(`/api/pitches/${pitch.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'revoked' }) })
      }
      await refresh()
      notify('Parent request revoked.')
    } catch (err) {
      notify(err.message)
    }
  }

  const completeChore = async (pitchId, choreIndex) => {
    try {
      await api(`/api/pitches/${pitchId}/chores/${choreIndex}/complete`, { method: 'POST' })
      await refresh()
      triggerCoinEarn(window.innerWidth / 2, window.innerHeight / 2, 8)
      notify('Chore completed — earned +25 LOOT Coins!')
    } catch (err) {
      notify(err.message)
    }
  }

  const totals = useMemo(() => {
    if (!state) return { saved: 0, target: 1, spent: 0, income: 0 }
    return {
      saved: state.goals.reduce((sum, goal) => sum + goal.saved, 0),
      target: state.goals.reduce((sum, goal) => sum + goal.target, 0),
      spent: Math.abs(state.transactions.filter(item => item.amount < 0).reduce((sum, item) => sum + item.amount, 0)),
      income: state.transactions.filter(item => item.amount > 0).reduce((sum, item) => sum + item.amount, 0),
    }
  }, [state])

  // Combined transactions between server state and IndexedDB money engine
  const allTransactions = useMemo(() => {
    const list = [...(state?.transactions || [])]
    if (accountingState?.transactions?.length) {
      const existingIds = new Set(list.map(t => String(t.id)))
      for (const t of accountingState.transactions) {
        if (!existingIds.has(String(t.id))) {
          const isDuplicate = list.some(item =>
            item.title === t.title &&
            Number(item.amount) === Number(t.amount) &&
            item.date === t.date
          )
          if (!isDuplicate) {
            list.push(t)
          }
        }
      }
    }
    return list
  }, [state?.transactions, accountingState])

  const weeklyBill = useMemo(() => {
    if (!allTransactions.length && !state) {
      return { credits: 0, debits: 0, net: 0, transactions: [], categories: [], topCategory: '—' }
    }
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    let refDate = today
    for (const t of allTransactions) {
      if (t.date) {
        const d = new Date(`${t.date}T23:59:59`)
        if (!isNaN(d.getTime()) && d > refDate) {
          refDate = d
        }
      }
    }
    const weekStart = new Date(refDate)
    weekStart.setDate(refDate.getDate() - 6)
    weekStart.setHours(0, 0, 0, 0)

    const transactions = allTransactions.filter(item => {
      if (!item.date) return false
      const date = new Date(`${item.date}T12:00:00`)
      return !isNaN(date.getTime()) && date >= weekStart && date <= refDate
    }).sort((a, b) => {
      const timeA = new Date(`${a.date}T12:00:00`).getTime() || 0
      const timeB = new Date(`${b.date}T12:00:00`).getTime() || 0
      return timeB - timeA
    })
    const categories = Object.entries(transactions.filter(item => isQualifyingExpense(item)).reduce((result, item) => {
      result[item.category] = (result[item.category] || 0) + Math.abs(item.amount)
      return result
    }, {})).sort((a, b) => b[1] - a[1])
    const credits = transactions.filter(item => item.amount > 0).reduce((sum, item) => sum + item.amount, 0)
    const debits = transactions.filter(item => isQualifyingExpense(item)).reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0)
    return { credits, debits, net: credits - debits, transactions, categories, topCategory: categories[0]?.[0] || '—' }
  }, [allTransactions, state])

  // Dynamic Weekly Budget Cadence & Remaining Stats
  const weeklyBudgetStats = useMemo(() => {
    return calculateWeeklyBudgetStats({
      weeklyBudget: state?.profile?.weeklyBudget,
      transactions: allTransactions
    })
  }, [state?.profile?.weeklyBudget, allTransactions])

  const handleSetWeeklyBudget = useCallback(async (newBudget) => {
    try {
      const budgetNum = Number(newBudget)
      setState(prev => prev ? {
        ...prev,
        profile: { ...prev.profile, weeklyBudget: budgetNum }
      } : prev)

      await api('/api/budget', {
        method: 'PATCH',
        body: JSON.stringify({ weeklyBudget: budgetNum })
      })
      notify(`Weekly budget set to ₹${budgetNum.toLocaleString('en-IN')}`)
    } catch (err) {
      notify(err.message || 'Failed to update weekly budget')
    }
  }, [notify])

  const results = useMemo(() => {
    if (!state || !search.trim()) return []
    const query = search.toLowerCase()
    return [
      ...state.goals,
      ...state.transactions,
      ...state.challenges,
      ...state.pitches,
      ...state.pools,
      ...(state.coinTransactions || [])
    ].filter(item => JSON.stringify(item).toLowerCase().includes(query))
  }, [state, search])

  if (parentToken) {
    return <ParentPortal token={parentToken} />
  }

  if (loading) return (
    <div className="loading-screen">
      <LootLogo intro={false} showWordmark={true} size="md" />
      <p>Loading your money universe...</p>
    </div>
  )
  if (!signedIn) return (
    <div className="signed-out-screen">
      <div className="signed-out-card card">
        <div className="brand" style={{ justifyContent: 'center' }}>
          <LootLogo intro={false} showWordmark={true} size="md" />
        </div>
        <span className="section-kicker">LOCAL SESSION</span>
        <h1>Ready to make a money move?</h1>
        <p>LOOT has no account system here. Sign in simply resumes your saved local profile.</p>
        <button className="primary-button" onClick={() => setSignedIn(true)}>Sign in to LOOT →</button>
        <small>Your data stays in <code>server/db.json</code>.</small>
      </div>
    </div>
  )
  if (!state) return <div className="loading-screen"><strong>LOOT is offline</strong><p>Start the API with <code>npm run server</code>.</p></div>

  const percent = Math.min(100, Math.round((totals.saved / Math.max(1, totals.target)) * 100))
  const profileCoins = state.profile.coins || 0
  const isNewUser = state.profile.experienceMode === 'new_user' || (state.transactions.length === 0 && totals.saved === 0 && state.goals.length === 0)
  const coinStats = state.coinStats || {
    level: isNewUser ? 1 : 3,
    rank: state.profile.rank || (isNewUser ? 'Saving Rookie' : 'Money Scout'),
    progressPercent: isNewUser ? 0 : Math.min(100, Math.round(profileCoins / 20))
  }

  return (
    <>
      <SplashScreen
        forceShow={splashPreview}
        onFinish={() => {
          setSplashPreview(false)
          setSplashFinished(true)
        }}
      />
      {splashFinished && !accountingState.onboardingCompleted && (
        <WalletOnboardingModal
          onComplete={(openingAmt) => {
            notify(`Wallet initialized with ₹${Number(openingAmt).toLocaleString('en-IN')} opening balance!`)
          }}
        />
      )}
      {pendingOverspendExpense && (
        <OverspendingConfirmModal
          isOpen={Boolean(pendingOverspendExpense)}
          availableBalance={pendingOverspendExpense.availableBalance}
          requestedAmount={pendingOverspendExpense.requestedAmount}
          shortfallAmount={pendingOverspendExpense.shortfallAmount}
          transactionTitle={pendingOverspendExpense.expenseData.title}
          onCancel={() => setPendingOverspendExpense(null)}
          onContinue={() => executeExpense(pendingOverspendExpense.expenseData, true)}
        />
      )}
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand" onClick={() => setActivePage('Dashboard')} style={{ cursor: 'pointer' }} title="LOOT Dashboard">
            <LootLogo intro={false} showWordmark={true} size="sm" />
          </div>
        <div className="nav-label">MONEY HQ</div>
        <nav className="main-nav">
          {navItems.map(([label, icon]) => (
            <button
              key={label}
              className={activePage === label ? 'nav-item active' : 'nav-item'}
              onClick={() => setActivePage(label)}
            >
              <span className="nav-icon">{icon}</span>
              {label}
              {label === 'Wallet' && <span className="new-pill">VAULT</span>}
              {label === 'Smart Buy' && <span className="new-pill smartbuy-pill">NEW</span>}
              {label === 'Ask Parent' && <span className="new-pill">PITCH</span>}
            </button>
          ))}
        </nav>

        <div className="nav-divider" />
        <nav className="main-nav">
          <button className="nav-item" onClick={() => setModal('profile')}>
            <span className="nav-icon">◉</span>Profile
          </button>
        </nav>

        <div className="sidebar-spacer" />

        {/* Level & Coin Vault Widget */}
        <div
          className="level-mini"
          style={{ cursor: 'pointer' }}
          onClick={() => setActivePage('Wallet')}
          title="Open Central LOOT Coin Wallet"
        >
          <div className="level-top">
            <LootCoin size="sm" glow />
            <div>
              <strong>{profileCoins.toLocaleString('en-IN')} Coins</strong>
              <small>★ Level {coinStats.level} · {state.profile.rank}</small>
            </div>
            <span className="more">◈</span>
          </div>
          <div className="coin-meter">
            <span>COIN VAULT</span>
            <CoinBadge amount={profileCoins} size="xs" variant="lime" />
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${coinStats.progressPercent}%` }}
            />
          </div>
        </div>

        <div className="sidebar-footer">◐ LOOT v2.0 <span className="online-dot" /></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="topbar-brand-wrap">
              <div
                className="topbar-logo"
                onClick={() => setActivePage('Dashboard')}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="LOOT Dashboard"
              >
                <LootLogo intro={false} showWordmark={false} size="xs" />
              </div>
              <div className="search-wrap desktop-search">
                <span>⌕</span>
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search LOOT (goals, spends, hub)..."
                />
                <kbd>⌘ K</kbd>
              </div>
            </div>

            <div className="top-actions">
              <button
                className="icon-button mobile-search-toggle"
                onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
                title="Search LOOT"
                aria-label="Search LOOT"
              >
                ⌕
              </button>

              <div
                id="header-coin-counter"
                className="header-coin-pill"
                onClick={() => setActivePage('Wallet')}
                title="LOOT Coin Vault - Click to open"
                style={{ cursor: 'pointer' }}
              >
                <LootCoin size="xs" glow />
                <span className="header-coin-count"><AnimatedNumber value={profileCoins} /></span>
                <span className="header-coin-label">COINS</span>
              </div>

              <button
                className="icon-button audio-toggle-btn"
                onClick={() => setSfxMuted(!sfxMuted)}
                title={sfxMuted ? 'Unmute Audio SFX' : 'Mute Audio SFX'}
                aria-label={sfxMuted ? 'Unmute Audio SFX' : 'Mute Audio SFX'}
              >
                {sfxMuted ? '🔇' : '🔊'}
              </button>

              <button
                className="icon-button notif-btn"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                title="Notifications"
                aria-label="Notifications"
              >
                ♧
                <span className="notification-dot">
                  {state.notifications.filter(item => !item.read).length}
                </span>
              </button>

              <div className="user-menu-wrap">
                <button
                  className="user-chip"
                  onClick={() => setProfileOpen(!profileOpen)}
                >
                  <span className={`avatar ${state.profile.accent || 'lime'}`}>
                    {state.profile.avatar || 'A'}
                  </span>
                  <span className="user-chip-text">
                    <strong>{state.profile.name}</strong>
                    <small>
                      <CoinBadge amount={profileCoins} size="xs" /> · {state.profile.rank}
                    </small>
                  </span>
                  <span className="chevron">⌄</span>
                </button>

                {profileOpen && (
                  <div className="dropdown">
                    <div className="dropdown-mode-badge">
                      <span>ACTIVE EXPERIENCE</span>
                      <strong>{isNewUser ? '🌱 Rookie Journey (New User)' : '⚡ Loaded Vault (Test User)'}</strong>
                    </div>
                    <button onClick={() => { setModal('profile'); setProfileOpen(false) }}>
                      Switch Experience / Profile
                    </button>
                    <button onClick={() => { setActivePage('Wallet'); setProfileOpen(false) }}>
                      Open Coin Wallet (◈ {profileCoins})
                    </button>
                    <button onClick={() => { setActivePage('Loot Hub'); setProfileOpen(false) }}>
                      Open Loot Hub
                    </button>
                    <button className="danger-item" onClick={() => { setSignedIn(false); setProfileOpen(false) }}>
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {mobileSearchOpen && (
            <div className="mobile-search-overlay">
              <span>⌕</span>
              <input
                autoFocus
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search LOOT (goals, spends, hub)..."
              />
              <button
                className="mobile-search-close"
                onClick={() => setMobileSearchOpen(false)}
                aria-label="Close search"
              >
                ✕
              </button>
            </div>
          )}

          {notificationsOpen && (
            <div className="notification-panel">
              <strong>Notifications & Rewards</strong>
              {state.notifications.slice(0, 5).map(item => (
                <p key={item.id}>{item.icon} {item.text}</p>
              ))}
            </div>
          )}
        </header>

        <div className="content-wrap">
          {search && (
            <div className="search-results">
              <strong>Search results for “{search}”</strong>
              <span>{results.length} matches</span>
            </div>
          )}

          {activePage === 'Dashboard' ? (
            <Dashboard
              state={state}
              totals={totals}
              percent={percent}
              weeklyBill={weeklyBill}
              budgetStats={weeklyBudgetStats}
              onSetWeeklyBudget={handleSetWeeklyBudget}
              setModal={setModal}
              setActivePage={setActivePage}
              isNewUser={isNewUser}
              accountingState={accountingState}
              maturedSleepReminders={maturedSleepReminders}
              onSaveGoalFromReminder={handleSmartBuySaveGoal}
              onAskParentFromReminder={handleSmartBuyAskParent}
              onDismissReminder={handleDismissReminder}
              onPreviewGoalCelebration={() => setGoalCreatedCelebration({
                name: 'Demo Gaming Setup',
                target: 2000,
                category: 'Lifestyle'
              })}
            />
          ) : activePage === 'Wallet' ? (
            <WalletView
              state={state}
              refresh={refresh}
              notify={notify}
              setModal={setModal}
              accountingState={accountingState}
              smartBuySavings={smartBuySavings}
            />
          ) : activePage === 'Smart Buy' ? (
            <SmartBuyView
              onSaveGoal={handleSmartBuySaveGoal}
              onAskParent={handleSmartBuyAskParent}
              onSleepOnIt={handleSmartBuySleepOnIt}
              onComparisonCompleted={handleSmartBuyComparisonCompleted}
              smartBuySavings={smartBuySavings}
              recentComparisons={recentComparisons}
              onSelectRecentComparison={handleSelectRecentComparison}
              notify={notify}
              sleepReminders={sleepReminders}
            />
          ) : (
            <FeaturePage
              page={activePage}
              state={state}
              setModal={setModal}
              notify={notify}
              refresh={refresh}
              openReceipt={() => setReceiptOpen(true)}
              completeChore={completeChore}
              setActivePage={setActivePage}
              accountingState={accountingState}
              setExpenseModalTab={setExpenseModalTab}
              onPreviewFirstTxCelebration={() => setFirstTxCelebration({
                title: 'Demo Coffee & snack',
                amount: -180,
                category: 'Lifestyle'
              })}
              onPreviewGoalCelebration={() => setGoalCreatedCelebration({
                name: 'Demo Gaming Setup',
                target: 2000,
                category: 'Lifestyle'
              })}
              onPreviewPitchCelebration={(customPitch) => setPitchCelebration(customPitch || {
                amount: 2500,
                purpose: 'Demo Gaming Headset',
                reason: 'Better focus during online study sessions and gaming with friends.',
                chores: 'Clean room, Wash car, Walk dog',
                duration: '1 week',
                tasks: [
                  { title: 'Clean room every day', duration: '1 week', status: 'proposed' },
                  { title: 'Wash car on Saturday', duration: '1 hour', status: 'proposed' }
                ]
              })}
              onPreviewPoolCelebration={(customPool) => setCrewPoolCelebration(customPool || {
                name: 'Goa Trip Crew',
                target: 10000,
                purpose: 'Shared weekend trip',
                members: [
                  { name: 'Andy', target: 2500 },
                  { name: 'Priya', target: 2500 },
                  { name: 'Kabir', target: 2500 },
                  { name: 'Dev', target: 2500 }
                ]
              })}
              onOpenShare={(p) => setShareModalPitch(p)}
              onRevokePitch={handleRevokePitch}
              highlightedGoalId={highlightedGoalId}
              onOpenSplitDetails={setSelectedSplitForDetails}
              onDeleteGoal={handleDeleteGoal}
              setForm={setForm}
            />
          )}
        </div>
      </main>

      {modal && (
        <Modal
          type={modal}
          form={form}
          profile={state.profile}
          weeklyBill={weeklyBill}
          updateForm={updateForm}
          closeModal={closeModal}
          onCreateSplit={handleCreateSplit}
          addGoal={addGoal}
          handleEditGoal={handleEditGoal}
          addExpense={addExpense}
          addIncome={addIncome}
          addSplit={addSplit}
          addPool={addPool}
          addPitch={addPitch}
          addContribution={addContribution}
          handleWithdraw={handleWithdraw}
          goals={state.goals}
          saveProfile={saveProfile}
          switchExperienceMode={switchExperienceMode}
          isNewUser={isNewUser}
          accountingState={accountingState}
          notify={notify}
          expenseModalTab={expenseModalTab}
          setExpenseModalTab={setExpenseModalTab}
          state={state}
          onReplaySplash={() => {
            closeModal()
            setSplashPreview(true)
          }}
        />
      )}

      {selectedSplitForDetails && (
        <SplitDetailsModal
          split={selectedSplitForDetails}
          closeModal={() => setSelectedSplitForDetails(null)}
          onToggleParticipantPaid={handleToggleParticipantPaid}
          onSettleAll={handleSettleAll}
          onDeleteSplit={handleDeleteSplit}
        />
      )}

      {receiptOpen && (
        <ReceiptScanner
          onClose={() => setReceiptOpen(false)}
          onResult={handleReceiptResult}
          notify={notify}
        />
      )}

      {firstTxCelebration && (
        <FirstTransactionCelebration
          isOpen={Boolean(firstTxCelebration)}
          transaction={typeof firstTxCelebration === 'object' ? firstTxCelebration : null}
          onClose={() => {
            setFirstTxCelebration(null)
            if (pendingSpendingImpact) {
              setSpendingImpact(pendingSpendingImpact)
              setPendingSpendingImpact(null)
            }
          }}
        />
      )}

      {spendingImpact && (
        <SpendingImpactModal
          impact={spendingImpact}
          onClose={() => setSpendingImpact(null)}
          onViewGoal={(goalId) => {
            setActivePage('Goals')
            setHighlightedGoalId(goalId)
            setTimeout(() => setHighlightedGoalId(null), 6000)
          }}
        />
      )}

      {goalCreatedCelebration && (
        <CreateGoalCelebration
          isOpen={Boolean(goalCreatedCelebration)}
          goal={typeof goalCreatedCelebration === 'object' ? goalCreatedCelebration : null}
          onClose={() => setGoalCreatedCelebration(null)}
        />
      )}

      {pitchCelebration && (
        <PitchCelebration
          isOpen={Boolean(pitchCelebration)}
          pitch={typeof pitchCelebration === 'object' ? pitchCelebration : null}
          sfxMuted={sfxMuted}
          onClose={() => setPitchCelebration(null)}
        />
      )}

      {crewPoolCelebration && (
        <CrewPoolCelebration
          isOpen={Boolean(crewPoolCelebration)}
          pool={typeof crewPoolCelebration === 'object' ? crewPoolCelebration : null}
          onClose={() => setCrewPoolCelebration(null)}
        />
      )}

      {firstSavingCelebration && (
        <FirstSavingCelebration
          isOpen={Boolean(firstSavingCelebration)}
          goal={firstSavingCelebration.goal}
          amount={firstSavingCelebration.amount}
          coinsEarned={firstSavingCelebration.coinsEarned}
          onClose={() => setFirstSavingCelebration(null)}
        />
      )}

      {levelUpCelebration && (
        <LevelUpCelebration
          isOpen={Boolean(levelUpCelebration)}
          level={levelUpCelebration.level}
          rank={levelUpCelebration.rank}
          onClose={() => setLevelUpCelebration(null)}
        />
      )}

      {shareModalPitch && (
        <ParentShareModal
          pitch={shareModalPitch}
          onClose={() => setShareModalPitch(null)}
          notify={notify}
        />
      )}

      <CoinFlyingEffect bursts={coinBursts} />

      {/* Mobile Bottom Tab Bar (fixed below 768px) */}
      <nav className="mobile-bottom-bar" aria-label="Mobile Navigation">
        {[
          ['Dashboard', '⌂'],
          ['Wallet', '◈'],
          ['Goals', '◎'],
          ['Money Lab', '✹'],
          ['Smart Buy', '⚡'],
          ['Loot Hub', '✦'],
          ['Ask Parent', '♡']
        ].map(([label, icon]) => (
          <button
            key={label}
            className={`mobile-tab-item ${activePage === label ? 'active' : ''}`}
            onClick={() => {
              setActivePage(label)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            aria-label={label}
          >
            <span className="mobile-tab-icon">{icon}</span>
            <span className="mobile-tab-label">{label}</span>
            {activePage === label && <span className="mobile-tab-glow" />}
          </button>
        ))}
      </nav>

      {toast && <div className="toast">✓ {toast}</div>}
    </div>

    {/* Mr. Spark Interactive Tour Spotlight Highlight */}
    <SparkTourSpotlight
      selector={spark.activeTourStep?.selector}
      isActive={Boolean(spark.activeTourStep)}
    />

    {/* Mr. Spark Mascot & Interactive Tutor */}
    <MrSpark spark={spark} />
    </>
  )
}

function Dashboard({
  state,
  totals,
  percent,
  weeklyBill,
  budgetStats = {},
  onSetWeeklyBudget,
  setModal,
  setActivePage,
  isNewUser,
  onPreviewGoalCelebration,
  accountingState = {},
  maturedSleepReminders = [],
  onSaveGoalFromReminder,
  onAskParentFromReminder,
  onDismissReminder
}) {
  const profileCoins = state.profile.coins || 0
  const availableBalance = accountingState.availableBalance !== undefined
    ? accountingState.availableBalance
    : Math.max(0, totals.income - totals.spent)

  const coinStats = state.coinStats || {
    level: isNewUser ? 1 : 3,
    rank: state.profile.rank || (isNewUser ? 'Saving Rookie' : 'Money Scout'),
    progressPercent: isNewUser ? 0 : Math.min(100, Math.round(profileCoins / 20))
  }

  return (
    <div className="dashboard-12col">
      {/* 1. GREETING (12 Columns) */}
      <section className="dashboard-hero-greeting col-12">
        <div className="greeting-text">
          <div className="eyebrow">
            <span>THURSDAY, NOVEMBER 6, 2026</span>
            <span className="live-pill"><span className="live-dot" /> LIVE SYNC</span>
          </div>
          <h1>Hey {state.profile.name.split(' ')[0]}! <span className="wave">👋</span></h1>
          <p className="greeting-sub">Track, save, and grow your money while leveling up your LOOT rank.</p>
        </div>
      </section>

      {/* 2. HERO STATS ROW (12 Columns: 4 Cards x 3 Columns each) */}
      <section className="hero-stats-row col-12" aria-label="Account core metrics">
        {/* Card 1: Total Balance */}
        <div className="card hero-stat-card">
          <div className="hero-stat-top">
            <span className="hero-stat-kicker">TOTAL BALANCE</span>
            <span className="hero-trend-badge">
              {accountingState.outstandingShortfall > 0 ? '⚠️ Deficit' : (isNewUser ? 'Fresh Start' : '↗ Active')}
            </span>
          </div>
          <div className="hero-stat-value">
            <span className="currency-symbol">₹</span>
            <strong className="stat-number">
              <AnimatedNumber value={availableBalance} formatIndian={true} />
            </strong>
            <span className="stat-decimals">.00</span>
          </div>
          <div className="hero-stat-sub">
            <span>Spent this week:</span>
            <b>₹{(budgetStats.spent !== undefined ? budgetStats.spent : totals.spent).toLocaleString('en-IN')}</b>
          </div>
        </div>

        {/* Card 2: Coin Vault */}
        <div
          className="card hero-stat-card clickable-card"
          onClick={() => setActivePage('Wallet')}
          title="Open Central LOOT Coin Wallet"
          tabIndex={0}
          role="button"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActivePage('Wallet') }}
        >
          <div className="hero-stat-top">
            <span className="hero-stat-kicker">COIN VAULT</span>
            <span className="coin-shortcut-pill">OPEN ◈</span>
          </div>
          <div className="hero-stat-value coin-val">
            <LootCoin size="sm" glow />
            <strong className="stat-number">
              <AnimatedNumber value={profileCoins} />
            </strong>
            <span className="stat-unit">COINS</span>
          </div>
          <div className="hero-stat-sub">
            <span>Rank status:</span>
            <b className="rank-accent">{state.profile.rank || 'Saving Rookie'}</b>
          </div>
        </div>

        {/* Card 3: Level & XP */}
        <div
          className="card hero-stat-card clickable-card"
          onClick={() => setActivePage('Wallet')}
          title="View level progression in Wallet"
          tabIndex={0}
          role="button"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActivePage('Wallet') }}
        >
          <div className="hero-stat-top">
            <span className="hero-stat-kicker">★ LEVEL {coinStats.level}</span>
            <span className="level-xp-text">{coinStats.progressPercent}% XP</span>
          </div>
          <div className="hero-stat-value">
            <strong className="stat-rank-title">{state.profile.rank}</strong>
          </div>
          <div className="hero-xp-track">
            <div className="hero-xp-fill" style={{ width: `${coinStats.progressPercent}%` }} />
          </div>
        </div>

        {/* Card 4: Weekly Bill */}
        <div
          className="card hero-stat-card clickable-card weekly-bill-card"
          onClick={() => setModal('weekly')}
          title="View weekly bill analysis"
          tabIndex={0}
          role="button"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setModal('weekly') }}
        >
          <div className="hero-stat-top">
            <span className="hero-stat-kicker">WEEKLY BILL</span>
            <span className="coin-shortcut-pill weekly-bill-badge">ANALYSIS ▣</span>
          </div>
          <div className="hero-stat-value weekly-bill-val">
            <span className="bill-btn-icon" style={{ fontSize: '22px', color: 'var(--lime)' }}>▣</span>
            <strong className="stat-number" style={{ fontSize: '22px' }}>
              Weekly Bill
            </strong>
          </div>
          <div className="hero-stat-sub">
            <span>Spend analysis & daily log</span>
            <b style={{ color: 'var(--lime)', fontFamily: 'var(--font-mono)' }}>OPEN ↗</b>
          </div>
        </div>
      </section>

      {/* 3. STARTER QUESTS (if new user) */}
      {isNewUser && (
        <section className="starter-quest-banner card col-12">
          <div className="starter-quest-head">
            <div>
              <span className="section-kicker">✦ ROOKIE STARTER QUESTS · FRESH JOURNEY</span>
              <h2>Welcome to LOOT! Start from scratch</h2>
              <p>Complete these initial moves to start saving, lodge transactions, and earn your first LOOT coins.</p>
            </div>
            <span className="quest-reward-pill">+12 ✦ Available</span>
          </div>
          <div className="starter-quest-grid">
            <div className={`quest-card ${state.goals.length > 0 ? 'done' : ''}`}>
              <span className="quest-step">1</span>
              <div>
                <strong>Set a Savings Goal</strong>
                <small>Create your first goal to earn +10 coins</small>
              </div>
              {state.goals.length > 0 ? (
                <span className="quest-status">✓ Completed ({state.goals.length} active)</span>
              ) : (
                <button className="primary-button" onClick={() => setModal('goal')}>＋ Set Goal (+10 ✦)</button>
              )}
            </div>

            <div className={`quest-card ${state.transactions.length > 0 ? 'done' : ''}`}>
              <span className="quest-step">2</span>
              <div>
                <strong>Lodge Your First Spend</strong>
                <small>Record an expense or scan a receipt</small>
              </div>
              {state.transactions.length > 0 ? (
                <span className="quest-status">✓ Completed ({state.transactions.length} lodged)</span>
              ) : (
                <button className="primary-button" onClick={() => setModal('expense')}>＋ Lodge Spend (+2 ✦)</button>
              )}
            </div>

            <div className={`quest-card ${profileCoins > 0 ? 'done' : ''}`}>
              <span className="quest-step">3</span>
              <div>
                <strong>Explore Coin Vault</strong>
                <small>View your ledger and perk store</small>
              </div>
              <button className="secondary-button" onClick={() => setActivePage('Wallet')}>◈ View Vault</button>
            </div>
          </div>
        </section>
      )}

      {/* 4. MAIN DASHBOARD CONTENT (8 Columns) */}
      <div className="col-8 dashboard-main-col">
        {/* 24-Hour Sleep on It Impulse Nudge (when >= 24h passed) */}
        {maturedSleepReminders && maturedSleepReminders.length > 0 && (
          <div className="card smartbuy-sleep-nudge-card">
            <div className="sleep-nudge-header">
              <div className="sleep-nudge-title-wrap">
                <span className="nudge-moon-icon">🌙</span>
                <div>
                  <span className="section-kicker">24-HOUR IMPULSE CHECK</span>
                  <h3>Still want the <em>{maturedSleepReminders[0].item}</em>?</h3>
                </div>
              </div>
              <span className="nudge-status-badge">⏰ 24h+ Cooldown Complete</span>
            </div>
            <p className="sleep-nudge-text">
              You chose to sleep on this purchase to avoid an impulse spend. Best deal found was{' '}
              <strong className="nudge-price">₹{Number(maturedSleepReminders[0].price).toLocaleString('en-IN')}</strong> on <b>{maturedSleepReminders[0].store}</b>{maturedSleepReminders[0].savings ? ` (saved ₹${Number(maturedSleepReminders[0].savings).toLocaleString('en-IN')})` : ''}. If it is a real priority, turn it into a savings mission or pitch your parents!
            </p>
            <div className="sleep-nudge-actions">
              <button
                className="primary-button"
                onClick={() => onSaveGoalFromReminder && onSaveGoalFromReminder(maturedSleepReminders[0])}
              >
                ◎ Save as goal (+10 ✦)
              </button>
              <button
                className="secondary-button"
                onClick={() => onAskParentFromReminder && onAskParentFromReminder(maturedSleepReminders[0])}
              >
                ♡ Ask a parent (+5 ✦)
              </button>
              <button
                className="text-button sleep-nudge-dismiss"
                onClick={() => onDismissReminder && onDismissReminder(maturedSleepReminders[0].id || maturedSleepReminders[0].item)}
              >
                ✕ Impulse beaten! Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Outstanding Shortfall Status & Settlement Card */}
        <OutstandingShortfallCard
          outstandingShortfall={accountingState.outstandingShortfall || 0}
          totalShortfallOriginal={accountingState.totalShortfallOriginal || 0}
          totalShortfallSettled={accountingState.totalShortfallSettled || 0}
          recentShortfall={accountingState.shortfalls?.[0] || null}
          onViewDetails={() => setActivePage('Money Lab')}
        />

        {/* Weekly Remaining Budget Section (LEFT THIS WEEK) */}
        <WeeklyBudgetCard
          budgetStats={budgetStats}
          onSetBudget={onSetWeeklyBudget}
          onLogSpend={() => setModal('expense')}
        />

        {/* Savings Overview Card with SVG Progress Ring */}
        <section className="savings-card card">
          <div className="card-heading">
            <div>
              <span className="section-kicker">SAVINGS MISSIONS</span>
              <h2>Build your future, <em>one save</em> at a time.</h2>
            </div>
            <span
              style={{ cursor: 'pointer' }}
              onClick={() => setActivePage('Wallet')}
              title="Open Coin Wallet"
            >
              <CoinBadge amount={profileCoins} size="sm" variant="lime" glow />
            </span>
          </div>

          <div className="savings-main">
            <SavingsProgressRing percent={percent} size={144} strokeWidth={12} />
            <div className="savings-stat">
              <span className="savings-stat-label">Total saved</span>
              <strong className="savings-stat-amount">
                ₹<AnimatedNumber value={totals.saved} formatIndian={true} />
              </strong>
              <small className="savings-stat-target">
                of ₹{totals.target.toLocaleString('en-IN')} target
              </small>
              <button className="primary-button" onClick={() => setModal('goal')}>
                ＋ New savings goal (+10 ✦)
              </button>
            </div>
          </div>

          <div className="quote-line">
            <span>✦</span> “Little drops make the mighty ocean.” <span>— Unknown</span>
          </div>
        </section>

        {/* Active Missions / Goals */}
        <section className="goals-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">ACTIVE GOALS</span>
              <h2>Your saving missions</h2>
            </div>
            <button className="text-button" onClick={() => setActivePage('Goals')}>
              Manage all →
            </button>
          </div>
          <div className="goals-list">
            {state.goals.length > 0 ? (
              state.goals.map(goal => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  transactions={state.transactions}
                  parentRequests={state.parentRequests}
                  onAdd={() => setModal(`contribute:${goal.id}`)}
                />
              ))
            ) : (
              <GoalsEmptyState
                onCreateGoal={() => setModal('goal')}
                onPreviewArt={onPreviewGoalCelebration}
              />
            )}
          </div>
        </section>

        {/* Spending Breakdown Card with Rupees vs Relatable Toggle */}
        <SpendingBreakdownCard
          categories={weeklyBill.categories}
          totalSpent={budgetStats.spent !== undefined && budgetStats.spent > 0 ? budgetStats.spent : (weeklyBill.debits || totals.spent)}
          txCount={budgetStats.txCount || weeklyBill.transactions.length}
          onAddSpend={() => setModal('expense')}
        />
      </div>

      {/* 5. SIDEBAR / SECONDARY COLUMN (4 Columns) */}
      <aside className="col-4 dashboard-side-col">
        {/* Quick Actions Card */}
        <div className="card quick-actions-card">
          <div className="card-heading">
            <span className="section-kicker">QUICK ACTIONS</span>
          </div>
          <div className="quick-actions-grid">
            <button onClick={() => setModal('goal')} className="quick-action-tile">
              <span className="action-icon lime">◎</span>
              <strong>Set a Goal</strong>
              <small>+10 ✦ bonus</small>
            </button>
            <button onClick={() => setModal('expense')} className="quick-action-tile">
              <span className="action-icon pink">↗</span>
              <strong>Log a Spend</strong>
              <small>+2 ✦ bonus</small>
            </button>
            <button onClick={() => setActivePage('Wallet')} className="quick-action-tile">
              <span className="action-icon yellow">◈</span>
              <strong>Coin Vault</strong>
              <small>{profileCoins} coins</small>
            </button>
            <button onClick={() => setActivePage('Money Lab')} className="quick-action-tile">
              <span className="action-icon purple">✹</span>
              <strong>Money Lab</strong>
              <small>Ledger & splits</small>
            </button>
            <button onClick={() => setActivePage('Smart Buy')} className="quick-action-tile smartbuy-action-tile">
              <span className="action-icon cyan">⚡</span>
              <strong>Smart Buy</strong>
              <small>Compare prices</small>
            </button>
          </div>
        </div>

        {/* Leaderboard Card */}
        <Leaderboard
          coins={profileCoins}
          profile={state.profile}
          isNewUser={isNewUser}
        />
      </aside>
    </div>
  )
}

function Leaderboard({ coins = 0, profile, isNewUser }) {
  const currentLeaderboard = useMemo(() => {
    const currentName = profile?.name || (isNewUser ? 'Rookie Saver' : 'Andy Joshi')
    const currentRank = profile?.rank || (isNewUser ? 'Saving Rookie' : 'Money Scout')
    const currentAvatar = profile?.avatar || (isNewUser ? 'R' : 'A')
    const currentScore = Number(coins) || 0

    return leaderboard
      .map(p => {
        if (p.current) {
          return {
            ...p,
            name: currentName,
            rank: currentRank,
            avatar: currentAvatar,
            score: currentScore,
            coins: currentScore
          }
        }
        return p
      })
      .sort((a, b) => b.score - a.score)
  }, [coins, profile, isNewUser])

  return (
    <section className="card leaderboard-card">
      <div className="section-heading">
        <div>
          <span className="section-kicker">LOOT LEAGUE</span>
          <h3>Weekly leaderboard</h3>
        </div>
        <span className="live-tag">LIVE</span>
      </div>
      <p className="leaderboard-sub">Ranked by coins earned from verified money habits.</p>
      <div className="leaderboard-list">
        {currentLeaderboard.map((player, index) => (
          <div className={`leaderboard-row ${player.current ? 'current' : ''}`} key={player.name}>
            <span className={`leaderboard-rank rank-${index + 1}`}>{index + 1}</span>
            <span className={`leaderboard-avatar ${player.color}`}>{player.avatar}</span>
            <div>
              <strong>{player.name}{player.current && <small> YOU</small>}</strong>
              <span>{player.rank} · {player.coins} coins</span>
            </div>
            <b><CoinBadge amount={player.score} size="xs" variant={player.current ? 'lime' : 'gold'} /></b>
          </div>
        ))}
      </div>
    </section>
  )
}

function GoalRow({ goal, onAdd, transactions = [], parentRequests = [] }) {
  const pace = calculateSavingsPace(goal, transactions, parentRequests)
  const eta = calculateGoalEta(goal, pace)

  return (
    <div className="goal-row">
      <div className={`goal-icon ${goal.color}`}>{goal.icon}</div>
      <div className="goal-info">
        <div className="goal-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong>{goal.name}</strong>
            <span className={`goal-status-badge ${eta.statusKey}`} style={{ fontSize: '9px', padding: '1px 5px' }}>
              {eta.status}
            </span>
          </div>
          <span>{goal.category} · {goal.deadline || 'No deadline'}</span>
        </div>
        <div className="goal-bar">
          <div
            className={`goal-bar-fill ${goal.color}`}
            style={{ width: `${eta.progressPercent}%` }}
          />
        </div>
        <div className="goal-meta">
          <span>₹{goal.saved.toLocaleString('en-IN')} saved · Remaining: ₹{eta.remaining.toLocaleString('en-IN')}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {eta.isCompleted ? (
              <span style={{ color: '#c8ff3d', fontWeight: 'bold' }}>✓ Completed</span>
            ) : eta.weeklyPace > 0 ? (
              <span style={{ color: '#9cb09e' }}>ETA: <b style={{ color: '#c8ff3d' }}>{eta.formattedDate}</b></span>
            ) : (
              <span style={{ color: '#7a8c7c' }}>Start saving for ETA</span>
            )}
            <CoinBadge amount={50} prefix="+" suffix="finish bonus" size="xs" variant="lime" />
          </span>
        </div>
      </div>
      <button className="add-button" onClick={onAdd} title="Save towards this goal">＋</button>
    </div>
  )
}

function FeaturePage({ page, state, setModal, notify, refresh, openReceipt, completeChore, setActivePage, onPreviewFirstTxCelebration, onPreviewGoalCelebration, onPreviewPitchCelebration, onPreviewPoolCelebration, onOpenShare, onRevokePitch, accountingState = {}, setExpenseModalTab, highlightedGoalId, onOpenSplitDetails, onDeleteGoal, setForm }) {
  const copy = {
    Goals: ['Goals', 'Turn small saves into big wins and earn coin rewards.'],
    'Money Lab': ['Money Lab', 'Track expenses, split bills, and conquer habit challenges.'],
    'Loot Hub': ['Loot Hub', 'Your crew pools, arcade achievements, and wallet overview.'],
    'Ask Parent': ['Ask Parent', 'Make your money pitch count and complete chores for coins.']
  }[page]

  // Goals View
  if (page === 'Goals') {
    return (
      <DataPage
        title={copy[0]}
        subtitle={copy[1]}
        action="＋ New goal (+10 ✦)"
        onAction={() => setModal('goal')}
        secondaryAction="✦ Goal Art"
        onSecondaryAction={onPreviewGoalCelebration}
      >
        <div className="rewards-hero card" style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <span className="section-kicker">GOAL ENGINE REWARDS</span>
              <h2 style={{ margin: '6px 0' }}>Earn LOOT Coins Every Time You Save</h2>
              <p style={{ margin: 0, color: '#97a698', fontSize: '11px' }}>
                Receive +1 coin for every ₹50 saved, plus a +50 LOOT Coin completion bonus when target is reached!
              </p>
            </div>
            <CoinBadge amount={state.profile.coins} size="lg" variant="lime" glow />
          </div>
        </div>

        <div className="feature-grid">
          {state.goals.length > 0 ? (
            state.goals.map(goal => {
              const pace = calculateSavingsPace(goal, state.transactions, state.parentRequests)
              const eta = calculateGoalEta(goal, pace)
              const isHighlighted = String(highlightedGoalId) === String(goal.id)

              return (
                <div
                  className={`feature-card card goal-card ${isHighlighted ? 'highlight-pulse' : ''}`}
                  key={goal.id}
                  id={`goal-card-${goal.id}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div className={`goal-icon ${goal.color}`}>{goal.icon}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <span className={`goal-status-badge ${eta.statusKey}`}>
                        {eta.status === 'Completed' && '✓ '}
                        {eta.status === 'On Track' && '⚡ '}
                        {eta.status === 'Behind Pace' && '⚠️ '}
                        {eta.status === 'Almost There' && '✦ '}
                        {eta.status}
                      </span>
                      <CoinBadge amount={50} prefix="+" suffix="Bonus" size="xs" variant={eta.isCompleted ? 'lime' : 'yellow'} />
                    </div>
                  </div>

                  <span className="section-kicker">{goal.category}</span>
                  <h3 style={{ margin: '6px 0 4px', fontSize: '17px' }}>{goal.name}</h3>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '8px' }}>
                    <strong style={{ fontSize: '20px', margin: 0 }}>
                      ₹{goal.saved.toLocaleString('en-IN')} <small>/ ₹{goal.target.toLocaleString('en-IN')}</small>
                    </strong>
                    <span style={{ fontSize: '11px', color: '#97a698', fontFamily: 'var(--font-mono, monospace)' }}>
                      Remaining: <b style={{ color: '#e8f2e9' }}>₹{eta.remaining.toLocaleString('en-IN')}</b>
                    </span>
                  </div>

                  {/* Progress Bar & Percent */}
                  <div className="goal-bar" style={{ margin: '10px 0 6px' }}>
                    <div className={`goal-bar-fill ${goal.color}`} style={{ width: `${eta.progressPercent}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#8c9c8e', marginBottom: '10px' }}>
                    <span>Progress: <b style={{ color: '#c8ff3d' }}>{eta.progressPercent}%</b></span>
                    <span>{goal.deadline ? `Target: ${goal.deadline}` : 'Open ended'}</span>
                  </div>

                  {/* Savings Pace & ETA Box */}
                  <div className="goal-eta-box">
                    {eta.isCompleted ? (
                      <div className="goal-eta-completed">
                        <span>🏆</span> <strong>Mission accomplished! Target reached.</strong>
                      </div>
                    ) : eta.weeklyPace > 0 ? (
                      <>
                        <div className="goal-eta-row">
                          <span className="goal-eta-label">Savings pace:</span>
                          <strong className="goal-eta-value">₹{eta.weeklyPace.toLocaleString('en-IN')}/week</strong>
                        </div>
                        <div className="goal-eta-row">
                          <span className="goal-eta-label">Estimated completion:</span>
                          <strong className="goal-eta-value">{eta.formattedEta}</strong>
                        </div>
                        <div className="goal-eta-row highlight">
                          <span className="goal-eta-label">Expected date:</span>
                          <strong className="goal-eta-value date-val">{eta.formattedDate}</strong>
                        </div>
                      </>
                    ) : (
                      <div className="goal-eta-locked">
                        <span className="locked-icon">⏳</span>
                        <span>Start saving to unlock your ETA.</span>
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      className="primary-button"
                      style={{ padding: '7px 12px', fontSize: '11px', flex: 1 }}
                      onClick={() => setModal(`contribute:${goal.id}`)}
                    >
                      ＋ Save
                    </button>
                    {goal.saved > 0 && (
                      <button
                        className="secondary-button"
                        style={{ padding: '7px 10px', fontSize: '11px' }}
                        onClick={() => setModal(`withdraw:${goal.id}`)}
                        title="Withdraw funds from this goal"
                      >
                        ↺ Withdraw
                      </button>
                    )}
                    <button
                      className="secondary-button"
                      style={{ padding: '7px 10px', fontSize: '11px' }}
                      onClick={() => {
                        if (setForm) {
                          setForm(f => ({
                            ...f,
                            goal: {
                              name: goal.name || '',
                              category: goal.category || 'Lifestyle',
                              target: String(goal.target || ''),
                              deadline: goal.deadline || '',
                              weeklySavingsPace: String(goal.weeklySavingsPace || '')
                            }
                          }))
                        }
                        setModal(`edit-goal:${goal.id}`)
                      }}
                      title="Edit this goal"
                    >
                      ✏️ Edit
                    </button>
                    {onDeleteGoal && (
                      <button
                        className="ghost-button"
                        style={{ padding: '7px 10px', fontSize: '11px', color: '#ff4da6' }}
                        onClick={() => onDeleteGoal(goal.id)}
                        title="Delete this goal"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            <GoalsEmptyState
              onCreateGoal={() => setModal('goal')}
              onPreviewArt={onPreviewGoalCelebration}
            />
          )}
        </div>
      </DataPage>
    )
  }

  // Money Lab View
  if (page === 'Money Lab') {
    return (
      <DataPage title={copy[0]} subtitle={copy[1]}>
        <div className="money-lab-grid">
          {/* Expenses */}
          <section className="lab-section">
            <div className="lab-section-head">
              <div className="lab-head-info">
                <span className="section-kicker">EXPENSES</span>
                <h2>Money moves</h2>
              </div>
              <div className="lab-actions">
                {isDebugMode() && onPreviewFirstTxCelebration && (
                  <button
                    type="button"
                    className="dark-button dev-art-button"
                    title="Preview the transaction celebration animation"
                    onClick={onPreviewFirstTxCelebration}
                  >
                    ✦ Transaction Art
                  </button>
                )}
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    if (setExpenseModalTab) setExpenseModalTab('expense')
                    setModal('expense')
                  }}
                >
                  ＋ Log spend (+2 ✦)
                </button>
                <button type="button" className="secondary-button" onClick={openReceipt}>
                  ▣ Scan receipt (+5 ✦)
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    if (setExpenseModalTab) setExpenseModalTab('income')
                    setModal('expense')
                  }}
                >
                  ＋ Add money (+5 ✦)
                </button>
              </div>
            </div>

            {state.transactions.length > 0 ? (
              <div className="table-card card lab-card-fill">
                {state.transactions.map(item => (
                  <div className="table-row" key={item.id}>
                    <span className="activity-icon">{item.icon}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.category} · {item.date}</small>
                    </div>
                    <b className={item.amount > 0 ? 'income' : ''}>
                      {item.amount > 0 ? '+' : '-'}₹{Math.abs(item.amount).toLocaleString('en-IN')}
                    </b>
                  </div>
                ))}
              </div>
            ) : (
              <MoneyLabEmptyState
                onAddSpend={() => {
                  if (setExpenseModalTab) setExpenseModalTab('expense')
                  setModal('expense')
                }}
                onPreviewArt={onPreviewFirstTxCelebration}
              />
            )}
          </section>

          {/* Split Bills */}
          <section className="lab-section">
            <div className="lab-section-head">
              <div className="lab-head-info">
                <span className="section-kicker">SPLIT BILLS</span>
                <h2>Settle together</h2>
              </div>
              <div className="lab-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setModal('split')}
                >
                  ＋ Create split (+5 ✦)
                </button>
              </div>
            </div>

            {(state?.splits || []).length > 0 ? (
              <div className="feature-grid lab-splits-grid">
                {(state?.splits || []).map(split => (
                  <SplitBillCard
                    key={split.id}
                    split={split}
                    onOpenDetails={onOpenSplitDetails}
                  />
                ))}
              </div>
            ) : (
              <SplitBillsEmptyState onCreateSplit={() => setModal('split')} />
            )}
          </section>

          {/* Challenges with Idempotent Coin Claiming */}
          <section className="lab-section lab-wide">
            <div className="lab-section-head">
              <div className="lab-head-info">
                <span className="section-kicker">HABIT CHALLENGES</span>
                <h2>Earn Coins By Doing</h2>
              </div>
              <div className="lab-actions">
                <span
                  style={{ cursor: 'pointer' }}
                  onClick={() => setActivePage('Wallet')}
                  title="Open Coin Wallet"
                >
                  <CoinBadge amount={state.profile.coins} size="sm" variant="lime" />
                </span>
              </div>
            </div>

            <div className="challenges-grid">
              {state.challenges.map(challenge => {
                const isCompleted = challenge.status === 'completed'
                const isAvailable = challenge.status === 'available' || !challenge.joined

                return (
                  <div
                    className={`challenge-card card ${challenge.status}`}
                    key={challenge.id}
                  >
                    <div className="challenge-top">
                      <span className="challenge-icon">{isCompleted ? '✓' : '⚡'}</span>
                      <CoinBadge amount={challenge.reward} prefix="+" size="sm" variant="yellow" glow />
                    </div>
                    <div className="challenge-content">
                      <h3>{challenge.title}</h3>
                      <p>{challenge.description}</p>
                    </div>
                    <div className="challenge-progress-bar-wrap">
                      <div className="goal-bar">
                        <div
                          className="goal-bar-fill purple"
                          style={{ width: `${Math.min(100, (challenge.progress / challenge.target) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="challenge-footer">
                      <span className="challenge-progress-text">
                        {challenge.progress}/{challenge.target} complete
                      </span>
                      <div className="challenge-action-wrap">
                        {isAvailable ? (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={async () => {
                              try {
                                await api(`/api/challenges/${challenge.id}/join`, { method: 'POST' })
                                await refresh()
                                notify('Challenge joined — earned +5 LOOT Coins!')
                              } catch (err) {
                                notify(err.message)
                              }
                            }}
                          >
                            Join challenge (+5 ✦)
                          </button>
                        ) : isCompleted ? (
                          <button
                            type="button"
                            className="primary-button"
                            disabled
                            style={{ opacity: 0.8, cursor: 'default' }}
                          >
                            Completed & Claimed ✓
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="primary-button"
                            onClick={async () => {
                              try {
                                const res = await api(`/api/challenges/${challenge.id}/complete`, { method: 'POST' })
                                await refresh()
                                notify(`Challenge completed — +${res.challenge.reward} LOOT Coins added to wallet!`)
                              } catch (err) {
                                notify(err.message)
                              }
                            }}
                          >
                            Complete & claim (+{challenge.reward} ✦)
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Central Money Engine: Outstanding Shortfalls & Debt Management */}
          <section className="lab-section lab-wide">
            <ShortfallsSection
              accountingState={accountingState}
              notify={notify}
            />
          </section>
        </div>
      </DataPage>
    )
  }

  // Loot Hub View
  if (page === 'Loot Hub') {
    const unlocked = state.achievements.filter(item => item.unlocked).length
    const poolTotal = state.pools.reduce((sum, pool) => sum + pool.members.reduce((memberSum, member) => memberSum + member.contributed, 0), 0)
    const activeChallenges = state.challenges.filter(challenge => challenge.status !== 'completed').length

    return (
      <DataPage
        title={copy[0]}
        subtitle={copy[1]}
        action="＋ Create pool (+10 ✦)"
        onAction={() => setModal('pool')}
        secondaryAction="✦ Pool Art"
        onSecondaryAction={onPreviewPoolCelebration}
      >
        <div className="hub-hero card">
          <div className="hub-hero-grid">
            <div>
              <span className="section-kicker">THE LOOT ARCADE</span>
              <h2>Level up your real life.</h2>
              <p>Every smart money move powers your wallet, your streak, and your crew.</p>
              <div className="hub-hero-actions">
                <button className="primary-button" onClick={() => setActivePage('Wallet')}>
                  ◈ View Digital Wallet
                </button>
                <button className="secondary-button" onClick={() => setModal('pool')}>
                  ＋ Start a crew pool
                </button>
                <span className="hub-status"><i /> CENTRAL ENGINE ONLINE</span>
              </div>
            </div>

            <div
              className="coin-orbit"
              style={{ cursor: 'pointer' }}
              onClick={() => setActivePage('Wallet')}
              title="Click to view Coin Vault"
            >
              <div className="orbit-ambient-glow" />
              <span className="orbit-ring ring-one">
                <i className="orbit-particle particle-one" />
              </span>
              <span className="orbit-ring ring-two">
                <i className="orbit-particle particle-two" />
              </span>
              <div className="orbit-coin">
                <div className="orbit-coin-gleam" />
                <LootCoin size="md" glow />
                <small>LOOT</small>
              </div>
              <div className="orbit-sparkles" aria-hidden="true">
                <span className="sparkle s1">✦</span>
                <span className="sparkle s2">✦</span>
                <span className="sparkle s3">✦</span>
              </div>
            </div>
          </div>
        </div>

        <div className="hub-stat-grid">
          <div
            className="hub-stat card"
            style={{ cursor: 'pointer' }}
            onClick={() => setActivePage('Wallet')}
            title="Open Coin Wallet"
          >
            <span className="stat-symbol lime">✦</span>
            <div>
              <span className="section-kicker">WALLET BALANCE</span>
              <strong><CoinBadge amount={state.profile.coins} size="lg" variant="lime" /></strong>
              <small>Click to open vault ledger</small>
            </div>
          </div>

          <div className="hub-stat card">
            <span className="stat-symbol cyan">⬡</span>
            <div>
              <span className="section-kicker">CREW SAVED</span>
              <strong>₹{poolTotal.toLocaleString('en-IN')}</strong>
              <small>across {state.pools.length} pool{state.pools.length === 1 ? '' : 's'}</small>
            </div>
          </div>

          <div className="hub-stat card">
            <span className="stat-symbol purple">◆</span>
            <div>
              <span className="section-kicker">UNLOCKED</span>
              <strong>{unlocked}/{state.achievements.length}</strong>
              <small>achievements collected</small>
            </div>
          </div>

          <div className="hub-stat card">
            <span className="stat-symbol pink">⚡</span>
            <div>
              <span className="section-kicker">NEXT MOVES</span>
              <strong>{activeChallenges}</strong>
              <small>challenges waiting</small>
            </div>
          </div>
        </div>

        <div className="hub-grid">
          <section className="hub-panel">
            <div className="hub-panel-head">
              <div>
                <span className="section-kicker">CREW MISSIONS</span>
                <h2>Build it together</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {onPreviewPoolCelebration && (
                  <button
                    type="button"
                    className="text-button"
                    style={{ color: 'var(--lime)', border: '1px solid rgba(103,255,58,0.25)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px' }}
                    onClick={() => onPreviewPoolCelebration()}
                    title="Review Crew Pool celebration animation"
                  >
                    ✦ Review Art
                  </button>
                )}
                <button className="text-button" onClick={() => setModal('pool')}>
                  New pool →
                </button>
              </div>
            </div>
            <div className="hub-pools">
              {state.pools.length ? (
                state.pools.map(pool => (
                  <PoolCard
                    key={pool.id}
                    pool={pool}
                    notify={notify}
                    refresh={refresh}
                    onPreviewPoolCelebration={onPreviewPoolCelebration}
                  />
                ))
              ) : (
                <EmptyState
                  text="Create a money pool with friends for trips, gifts, or shared goals."
                  action={onPreviewPoolCelebration ? (
                    <button
                      type="button"
                      className="dark-button"
                      style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => onPreviewPoolCelebration()}
                    >
                      ✦ Review Pool Art
                    </button>
                  ) : null}
                />
              )}
            </div>
          </section>

          <section className="hub-panel">
            <div className="hub-panel-head">
              <div>
                <span className="section-kicker">REWARD CABINET</span>
                <h2>Collect your flex</h2>
              </div>
              <span className="hub-count">{unlocked} unlocked</span>
            </div>
            <div className="achievement-grid">
              {state.achievements.map(item => (
                <div
                  className={`achievement-tile ${item.unlocked ? 'unlocked' : 'locked'}`}
                  key={item.id}
                >
                  <span className="achievement-icon">{item.icon}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                  <b><CoinBadge amount={item.reward} prefix="+" size="xs" variant={item.unlocked ? 'lime' : 'yellow'} /></b>
                </div>
              ))}
            </div>
          </section>
        </div>
      </DataPage>
    )
  }

  // Ask Parent View with Chores completion & Supabase Share Links
  return (
    <DataPage
      title={copy[0]}
      subtitle={copy[1]}
      action="＋ New pitch (+5 ✦)"
      onAction={() => setModal('pitch')}
      secondaryAction="✦ Pitch Art"
      onSecondaryAction={() => onPreviewPitchCelebration && onPreviewPitchCelebration()}
    >
      <div className="pitch-list">
        {state.pitches.length ? (
          state.pitches.map(pitch => {
            const shareUrl = pitch.parentShareUrl || `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/parent/${pitch.shareToken}`
            const statusLabel = {
              pending: '⏳ WAITING FOR PARENT',
              approved: '✓ APPROVED BY PARENT',
              declined: '✗ DECLINED BY PARENT',
              changes_requested: '💬 CHANGES REQUESTED',
              expired: '⏳ LINK EXPIRED',
              revoked: '🚫 REVOKED'
            }[pitch.status] || pitch.status.toUpperCase()

            const statusVariant = {
              pending: 'yellow',
              approved: 'lime',
              declined: 'pink',
              changes_requested: 'purple',
              expired: 'default',
              revoked: 'default'
            }[pitch.status] || 'lime'

            return (
              <div className="pitch-card card" key={pitch.id} style={{ display: 'block' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className={`parent-status-pill ${pitch.status}`} style={{ fontSize: '10px' }}>
                        {statusLabel}
                      </span>
                      <CoinBadge amount={5} prefix="+" suffix="Pitch reward" size="xs" variant={statusVariant} />
                    </div>
                    <h3 style={{ margin: '8px 0 4px', fontSize: '18px' }}>₹{pitch.amount.toLocaleString('en-IN')} for {pitch.purpose}</h3>
                    <p style={{ margin: 0, color: '#9cb09f', fontSize: '13px' }}>{pitch.reason}</p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {onPreviewPitchCelebration && (
                      <button
                        type="button"
                        className="dark-button"
                        style={{ padding: '6px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => onPreviewPitchCelebration(pitch)}
                        title="Review pitch celebration animation"
                      >
                        ✦ Review Art
                      </button>
                    )}

                    {onOpenShare && (
                      <button
                        type="button"
                        className="primary-button"
                        style={{ padding: '6px 12px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        onClick={() => onOpenShare(pitch)}
                        title="Open parent share options"
                      >
                        🔗 Share Link
                      </button>
                    )}

                    <button
                      type="button"
                      className="dark-button"
                      style={{ padding: '6px 10px', fontSize: '11px' }}
                      onClick={() => window.open(shareUrl, '_blank', 'noopener,noreferrer')}
                      title="Open parent view"
                    >
                      👁 View
                    </button>

                    {pitch.status === 'pending' && onRevokePitch && (
                      <button
                        type="button"
                        className="text-button"
                        style={{ color: '#ff6b8e', fontSize: '11px', padding: '6px 8px' }}
                        onClick={() => onRevokePitch(pitch)}
                        title="Revoke and cancel this parent request link"
                      >
                        🚫 Revoke
                      </button>
                    )}
                  </div>
                </div>

                {/* Parent Decision Note */}
                {pitch.parentMessage && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: pitch.status === 'approved' ? 'rgba(103, 255, 58, 0.1)' : pitch.status === 'declined' ? 'rgba(255, 94, 130, 0.1)' : 'rgba(138, 77, 255, 0.12)',
                      border: `1px solid ${pitch.status === 'approved' ? 'rgba(103, 255, 58, 0.3)' : pitch.status === 'declined' ? 'rgba(255, 94, 130, 0.3)' : 'rgba(138, 77, 255, 0.3)'}`
                    }}
                  >
                    <span className="section-kicker" style={{ fontSize: '9px', color: pitch.status === 'approved' ? '#67ff3a' : pitch.status === 'declined' ? '#ff6b8e' : '#d1b4ff' }}>
                      PARENT NOTE ({pitch.status.replace('_', ' ').toUpperCase()}):
                    </span>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#f7faf7', fontStyle: 'italic' }}>
                      "{pitch.parentMessage}"
                    </p>
                    {pitch.respondedAt && (
                      <small style={{ display: 'block', marginTop: '4px', color: '#8da28f', fontSize: '10px' }}>
                        Recorded on {new Date(pitch.respondedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </small>
                    )}
                  </div>
                )}

                {/* Pitch Chores List */}
                {Array.isArray(pitch.tasks) && pitch.tasks.length > 0 && (
                  <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #29382b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="section-kicker" style={{ fontSize: '9px' }}>CHORES & COMMITMENTS</span>
                      <small style={{ color: '#8da28f', fontSize: '10px' }}>
                        {pitch.status === 'approved' ? '✓ Parent approved — complete chores to claim coins!' : 'Earn coins when approved & completed'}
                      </small>
                    </div>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {pitch.tasks.map((task, idx) => {
                        const isDone = task.status === 'completed'
                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 12px',
                              background: isDone ? '#172719' : '#141d15',
                              border: '1px solid #2c3e2e',
                              borderRadius: '6px'
                            }}
                          >
                            <div>
                              <strong style={{ fontSize: '11px', color: isDone ? '#c8ff3d' : '#e6ede6' }}>
                                {isDone ? '✓ ' : '• '}{task.title}
                              </strong>
                              {task.duration && (
                                <small style={{ display: 'block', color: '#7a8b7b', fontSize: '9px' }}>
                                  Duration: {task.duration}
                                </small>
                              )}
                            </div>
                            <div>
                              {isDone ? (
                                <CoinBadge amount={25} prefix="+" suffix="Earned" size="xs" variant="lime" />
                              ) : pitch.status === 'revoked' ? (
                                <span style={{ fontSize: '9px', color: '#ff4da6', padding: '4px 6px', background: 'rgba(255, 77, 166, 0.1)', borderRadius: '4px' }}>
                                  Revoked
                                </span>
                              ) : (
                                <button
                                  className="primary-button"
                                  style={{ padding: '4px 8px', fontSize: '9px' }}
                                  onClick={() => completeChore(pitch.id, idx)}
                                >
                                  Mark Done (+25 ✦)
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="empty-state card">
            <LootCoin size="md" glow />
            <p style={{ marginTop: '10px' }}>
              Turn a money request into a thoughtful proposal your parent can review, and earn coins for completed chores.
            </p>
            {onPreviewPitchCelebration && (
              <button
                type="button"
                className="dark-button"
                style={{ marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => onPreviewPitchCelebration()}
              >
                ✦ Review Pitch Art
              </button>
            )}
          </div>
        )}
      </div>
    </DataPage>
  )
}

function DataPage({ title, subtitle, action, onAction, secondaryAction, onSecondaryAction, children }) {
  return (
    <section className="page-view">
      <div className="page-hero">
        <div>
          <span className="section-kicker">LOOT / {title.toUpperCase()}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {(action || secondaryAction) && (
          <div className="page-actions-head">
            {secondaryAction && (
              <button className="secondary-button" onClick={onSecondaryAction}>
                {secondaryAction}
              </button>
            )}
            {action && (
              <button className="primary-button" onClick={onAction}>
                {action}
              </button>
            )}
          </div>
        )}
      </div>
      {children}
    </section>
  )
}

function EmptyState({ text, action }) {
  return (
    <div className="empty-state card">
      <LootCoin size="md" glow />
      <p style={{ marginTop: '10px' }}>{text}</p>
      {action}
    </div>
  )
}

function PoolCard({ pool, notify, refresh, onPreviewPoolCelebration }) {
  const total = pool.members.reduce((sum, member) => sum + member.contributed, 0)
  const percent = Math.min(100, Math.round(total / Math.max(1, pool.target) * 100))

  const contribute = async () => {
    const raw = window.prompt(`How much are you adding to ${pool.name}?`, '500')
    const amount = Number(raw)
    if (!amount || amount < 1) return
    try {
      await api(`/api/pools/${pool.id}`, { method: 'PATCH', body: JSON.stringify({ contribution: amount }) })
      await refresh()
      notify(`₹${amount.toLocaleString('en-IN')} added to ${pool.name} — coins awarded!`)
    } catch (error) {
      notify(error.message)
    }
  }

  return (
    <div className="feature-card card pool-card">
      <div className="pool-card-top">
        <span className="pool-icon">⬡</span>
        <span className={`pool-status ${pool.status}`}>{pool.status}</span>
      </div>
      <span className="section-kicker">CREW POOL</span>
      <h3>{pool.name}</h3>
      <p>{pool.purpose}</p>
      <div className="pool-total">
        <strong>₹{total.toLocaleString('en-IN')}</strong>
        <span>of ₹{pool.target.toLocaleString('en-IN')}</span>
      </div>
      <div className="goal-bar">
        <div className="goal-bar-fill cyan" style={{ width: `${percent}%` }} />
      </div>
      <div className="pool-meta">
        <span>{percent}% funded</span>
        <span>{pool.members.length} members</span>
      </div>
      <div className="pool-members">
        {pool.members.map(member => (
          <span key={member.name} title={`${member.name}: ₹${member.contributed}`}>
            {member.name[0]}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'center' }}>
        <button className="primary-button" style={{ flex: 1 }} onClick={contribute}>
          ＋ Add contribution (+1 ✦ / ₹100)
        </button>
        {onPreviewPoolCelebration && (
          <button
            type="button"
            className="dark-button"
            style={{ padding: '8px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
            onClick={() => onPreviewPoolCelebration(pool)}
            title="Review Crew Pool celebration animation"
          >
            ✦ Review Art
          </button>
        )}
      </div>
    </div>
  )
}

function ReceiptScanner({ onClose, onResult, notify }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const activeRef = useRef(true)
  const [ready, setReady] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    activeRef.current = true
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is not available in this browser.')
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (!activeRef.current) return stream.getTracks().forEach(track => track.stop())
        streamRef.current = stream
        videoRef.current.srcObject = stream
        setReady(true)
      } catch (cameraError) {
        setError(cameraError.message || 'Camera permission was denied.')
      }
    }
    start()
    return () => {
      activeRef.current = false
      streamRef.current?.getTracks().forEach(track => track.stop())
    }
  }, [])

  const close = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    onClose()
  }

  const capture = async () => {
    if (!videoRef.current || !ready) return
    setScanning(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
      const { recognize } = await import('tesseract.js')
      const result = await recognize(canvas.toDataURL('image/jpeg', 0.9), 'eng')
      onResult(result.data.text)
    } catch (scanError) {
      notify(`Receipt scan failed: ${scanError.message || 'try again with better lighting'}`)
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="scanner-modal" onClick={event => event.stopPropagation()}>
        <div className="scanner-head">
          <div>
            <span className="section-kicker">RECEIPT SCANNER</span>
            <h2>Point, snap, log.</h2>
          </div>
          <button className="close-modal" onClick={close}>×</button>
        </div>
        <div className="camera-frame">
          {error ? (
            <div className="camera-error">
              <span>▣</span>
              <strong>Camera unavailable</strong>
              <p>{error} You can still log the spend manually.</p>
              <button className="secondary-button" onClick={close}>Enter manually</button>
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted />
              <div className="scan-corners" />
              <div className="scan-line" />
            </>
          )}
        </div>
        <p className="scanner-help">
          {scanning ? 'Reading receipt text… this can take a few seconds.' : 'Fit receipt inside the frame. Earn +5 LOOT Coins for scanning.'}
        </p>
        <div className="scanner-actions">
          <button className="secondary-button" onClick={close}>Cancel</button>
          <button className="primary-button" disabled={!ready || scanning} onClick={capture}>
            {scanning ? 'Scanning…' : 'Capture & extract (+5 ✦)'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Modal({
  type,
  form,
  profile,
  weeklyBill,
  updateForm,
  closeModal,
  addGoal,
  handleEditGoal,
  addExpense,
  addIncome,
  addSplit,
  onCreateSplit,
  addPool,
  addPitch,
  addContribution,
  handleWithdraw,
  goals = [],
  saveProfile,
  switchExperienceMode,
  isNewUser,
  onReplaySplash,
  accountingState = {},
  notify,
  expenseModalTab = 'expense',
  setExpenseModalTab,
  state = {}
}) {
  const kind = type.startsWith('contribute:')
    ? 'contribute'
    : type.startsWith('withdraw:')
      ? 'withdraw'
      : type.startsWith('edit-goal:')
        ? 'edit-goal'
        : type

  if (kind === 'weekly') {
    return (
      <ModalShell className="modal-weekly-bill" closeModal={closeModal}>
        <WeeklyBillModal
          bill={weeklyBill}
          onClose={closeModal}
          onAddSpend={() => setModal('expense')}
        />
      </ModalShell>
    )
  }

  if (kind === 'profile') {
    return (
      <ModalShell className="modal-profile-customizer" closeModal={closeModal}>
        <CustomizeProfileModal
          profile={profile}
          form={form}
          updateForm={updateForm}
          saveProfile={saveProfile}
          switchExperienceMode={switchExperienceMode}
          isNewUser={isNewUser}
          closeModal={closeModal}
          onReplaySplash={onReplaySplash}
          accountingState={accountingState}
          notify={notify}
        />
      </ModalShell>
    )
  }

  if (kind === 'withdraw') {
    const goalId = type.split(':')[1]
    const targetGoal = (goals || []).find(g => String(g.id) === String(goalId))
    const currentSaved = targetGoal?.saved || 0
    const withdrawAmount = Math.max(0, Number(form.goal.amount) || 0)
    const remainingSaved = Math.max(0, currentSaved - withdrawAmount)
    const isValidAmount = withdrawAmount > 0 && withdrawAmount <= currentSaved

    // Calculate pace & ETA before withdrawal
    const currentPace = targetGoal ? calculateSavingsPace(targetGoal, state?.transactions || [], state?.parentRequests || []) : { weeklyPace: 0 }
    const currentEta = targetGoal ? calculateGoalEta(targetGoal, currentPace) : null

    // Project ETA after withdrawal
    const futureGoal = targetGoal ? { ...targetGoal, saved: remainingSaved } : null
    const futureEta = futureGoal ? calculateGoalEta(futureGoal, currentPace) : null
    const delayDays = (futureEta && currentEta && futureEta.etaDays !== null && currentEta.etaDays !== null)
      ? Math.max(0, futureEta.etaDays - currentEta.etaDays)
      : null

    return (
      <ModalShell title={`Withdraw from ${targetGoal?.name || 'goal'}`} kicker="SAVINGS WITHDRAWAL" closeModal={closeModal}>
        {/* Warning Banner */}
        <div className="withdrawal-warning-banner" style={{ marginBottom: '14px', padding: '12px 14px', background: 'rgba(255, 77, 166, 0.12)', border: '1px solid #ff4da6', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <strong style={{ fontSize: '14px', color: '#ff4da6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              You're moving backwards!
            </strong>
          </div>
          <p style={{ margin: 0, color: '#f3c4db', fontSize: '12px', lineHeight: '1.4' }}>
            This withdrawal will reduce your savings progress and may delay your goal.
          </p>
        </div>

        {/* Savings Metrics Comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
          <div style={{ padding: '10px 12px', background: '#121a13', border: '1px solid #233525', borderRadius: '6px' }}>
            <span style={{ fontSize: '10px', color: '#8c9c8e', display: 'block', textTransform: 'uppercase' }}>Current Goal Savings</span>
            <strong style={{ fontSize: '16px', color: '#67ff3a' }}>
              ₹{currentSaved.toLocaleString('en-IN')}
            </strong>
          </div>
          <div style={{ padding: '10px 12px', background: '#121a13', border: '1px solid #233525', borderRadius: '6px' }}>
            <span style={{ fontSize: '10px', color: '#8c9c8e', display: 'block', textTransform: 'uppercase' }}>Remaining Goal Savings</span>
            <strong style={{ fontSize: '16px', color: isValidAmount ? '#ff77bb' : '#97a698' }}>
              ₹{remainingSaved.toLocaleString('en-IN')}
            </strong>
          </div>
        </div>

        {/* ETA Delay Impact Preview */}
        {currentEta && (
          <div style={{ marginBottom: '14px', padding: '10px 12px', background: '#1a1824', border: '1px solid #3d3558', borderRadius: '6px' }}>
            <span style={{ fontSize: '10px', color: '#b8aee0', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Goal Completion Timeline Impact
            </span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '12px' }}>
              <span style={{ color: '#a09bbd' }}>Estimated completion date before:</span>
              <strong style={{ color: '#67ff3a' }}>
                {currentEta.formattedDate !== 'Start saving to unlock ETA' && currentEta.formattedDate !== 'No ETA'
                  ? currentEta.formattedDate
                  : (currentEta.isCompleted ? 'Goal Completed' : 'Pace needed')}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '12px' }}>
              <span style={{ color: '#a09bbd' }}>Estimated completion date after:</span>
              <strong style={{ color: isValidAmount ? '#ff77bb' : '#a09bbd' }}>
                {isValidAmount && futureEta && futureEta.formattedDate !== 'Start saving to unlock ETA' && futureEta.formattedDate !== 'No ETA'
                  ? futureEta.formattedDate
                  : (isValidAmount ? 'Recalculating' : '—')}
              </strong>
            </div>
            {isValidAmount && delayDays !== null && delayDays > 0 && (
              <div style={{ marginTop: '8px', padding: '6px 8px', background: 'rgba(255, 77, 166, 0.15)', borderRadius: '4px', color: '#ff77bb', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⏱️</span>
                <span>Pushes your <b>{targetGoal?.name}</b> goal back by <b>{delayDays} days</b>.</span>
              </div>
            )}
          </div>
        )}

        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#c5d3c6' }}>
          Withdrawal amount (₹)
          <input
            type="number"
            min="1"
            max={currentSaved}
            value={form.goal.amount || ''}
            onChange={event => updateForm('goal', 'amount', event.target.value)}
            placeholder={`Up to ₹${currentSaved}`}
            autoFocus
            style={{ marginTop: '4px' }}
          />
        </label>
        {withdrawAmount > currentSaved && (
          <div style={{ color: '#ff4da6', fontSize: '11px', marginBottom: '8px' }}>
            ⚠️ Cannot withdraw ₹{withdrawAmount.toLocaleString('en-IN')}; maximum is ₹{currentSaved.toLocaleString('en-IN')}.
          </div>
        )}

        {/* Explicit confirmation */}
        <button
          className="primary-button full"
          disabled={!isValidAmount}
          style={{
            background: isValidAmount ? '#ff4da6' : '#3d2532',
            borderColor: isValidAmount ? '#ff4da6' : '#542b3c',
            color: '#fff',
            marginTop: '12px',
            opacity: isValidAmount ? 1 : 0.6,
            cursor: isValidAmount ? 'pointer' : 'not-allowed'
          }}
          onClick={() => handleWithdraw && handleWithdraw(goalId, form.goal.amount)}
        >
          {isValidAmount ? `Confirm Withdrawal of ₹${withdrawAmount.toLocaleString('en-IN')}` : 'Enter withdrawal amount'}
        </button>
      </ModalShell>
    )
  }

  if (kind === 'contribute') {
    const goalId = type.split(':')[1]
    const targetGoal = (goals || []).find(g => String(g.id) === String(goalId))
    const amountVal = Number(form.goal.amount) || 0
    const estCoins = Math.max(1, Math.round(amountVal / 50))
    const availableBalance = accountingState?.availableBalance || 0
    const isExceeding = amountVal > availableBalance

    return (
      <ModalShell title={`Add to ${targetGoal?.name || 'savings'}`} kicker="SAVE & ALLOCATE FUNDS" closeModal={closeModal}>
        <div style={{ marginBottom: '14px', padding: '10px 12px', background: '#172419', border: '1px solid #364d37', borderRadius: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#97a898', display: 'block' }}>AVAILABLE BALANCE</span>
              <strong style={{ fontSize: '15px', color: '#67ff3a' }}>
                ₹{availableBalance.toLocaleString('en-IN')}
              </strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '10px', color: '#97a898', display: 'block' }}>REWARD PREVIEW</span>
              <strong style={{ fontSize: '13px', color: '#c8ff3d' }}>
                +{amountVal > 0 ? estCoins : 0} LOOT Coins
              </strong>
            </div>
          </div>
          <small style={{ display: 'block', marginTop: '6px', color: '#8c9c8e', fontSize: '10px' }}>
            Money is transferred from your available spending balance into this goal's savings.
          </small>
        </div>
        <label>
          Amount
          <input
            type="number"
            min="1"
            max={availableBalance}
            value={form.goal.amount || ''}
            onChange={event => updateForm('goal', 'amount', event.target.value)}
            placeholder={`Available: ₹${availableBalance}`}
            autoFocus
          />
        </label>
        {isExceeding && (
          <div style={{ color: '#ff4da6', fontSize: '11px', marginTop: '6px' }}>
            ⚠️ Amount exceeds your available balance of ₹{availableBalance.toLocaleString('en-IN')}.
          </div>
        )}
        <button
          className="primary-button full"
          disabled={amountVal <= 0 || isExceeding}
          style={{ marginTop: '12px', opacity: (amountVal > 0 && !isExceeding) ? 1 : 0.6 }}
          onClick={() => addContribution(goalId, form.goal.amount)}
        >
          Add to goal & claim coins
        </button>
      </ModalShell>
    )
  }

  if (kind === 'goal') {
    return (
      <ModalShell title="Create a savings goal" kicker="NEW MISSION (+10 ✦)" closeModal={closeModal}>
        <form onSubmit={addGoal}>
          <Field label="Goal name">
            <input
              required
              value={form.goal.name}
              onChange={event => updateForm('goal', 'name', event.target.value)}
              placeholder="e.g. New headphones"
              autoFocus
            />
          </Field>
          <div className="form-grid">
            <Field label="Target amount">
              <input
                required
                type="number"
                min="1"
                value={form.goal.target}
                onChange={event => updateForm('goal', 'target', event.target.value)}
                placeholder="₹ 0"
              />
            </Field>
            <Field label="Deadline">
              <input
                type="date"
                value={form.goal.deadline}
                onChange={event => updateForm('goal', 'deadline', event.target.value)}
              />
            </Field>
          </div>
          <Field label="Category">
            <select
              value={form.goal.category}
              onChange={event => updateForm('goal', 'category', event.target.value)}
            >
              <option>Lifestyle</option>
              <option>Essentials</option>
              <option>Experiences</option>
              <option>Education</option>
            </select>
          </Field>
          {form.goal.link && (
            <Field label="Store / Deal link">
              <input
                type="url"
                value={form.goal.link}
                onChange={event => updateForm('goal', 'link', event.target.value)}
                placeholder="https://..."
              />
            </Field>
          )}
          <button className="primary-button full" type="submit">Create goal (+10 ✦)</button>
        </form>
      </ModalShell>
    )
  }

  if (kind === 'edit-goal') {
    const goalId = type.split(':')[1]
    const targetGoal = (goals || []).find(g => String(g.id) === String(goalId))
    return (
      <ModalShell title={`Edit ${targetGoal?.name || 'goal'}`} kicker="MANAGE GOAL" closeModal={closeModal}>
        <form onSubmit={event => handleEditGoal && handleEditGoal(goalId, event)}>
          <Field label="Goal name">
            <input
              required
              value={form.goal.name}
              onChange={event => updateForm('goal', 'name', event.target.value)}
              placeholder="e.g. New headphones"
              autoFocus
            />
          </Field>
          <div className="form-grid">
            <Field label="Target amount (₹)">
              <input
                required
                type="number"
                min="1"
                value={form.goal.target}
                onChange={event => updateForm('goal', 'target', event.target.value)}
                placeholder="₹ 0"
              />
            </Field>
            <Field label="Deadline">
              <input
                type="date"
                value={form.goal.deadline || ''}
                onChange={event => updateForm('goal', 'deadline', event.target.value)}
              />
            </Field>
          </div>
          <div className="form-grid">
            <Field label="Category">
              <select
                value={form.goal.category || 'Lifestyle'}
                onChange={event => updateForm('goal', 'category', event.target.value)}
              >
                <option>Lifestyle</option>
                <option>Essentials</option>
                <option>Experiences</option>
                <option>Education</option>
              </select>
            </Field>
            <Field label="Target pace (₹/week)">
              <input
                type="number"
                min="0"
                value={form.goal.weeklySavingsPace || ''}
                onChange={event => updateForm('goal', 'weeklySavingsPace', event.target.value)}
                placeholder="e.g. 500"
              />
            </Field>
          </div>
          <button className="primary-button full" type="submit" style={{ marginTop: '12px' }}>
            Save Changes
          </button>
        </form>
      </ModalShell>
    )
  }

  if (kind === 'expense') {
    const isIncome = expenseModalTab === 'income'
    return (
      <ModalShell
        title={isIncome ? 'Add money to wallet' : 'Log a spend'}
        kicker={isIncome ? 'FUNDS INFLOW (AUTO-SETTLES SHORTFALLS)' : 'RECORD SPEND (+2 ✦)'}
        closeModal={closeModal}
      >
        {/* Tab switch between Spend and Income */}
        <div className="modal-tab-switcher">
          <button
            type="button"
            className={`tab-btn ${!isIncome ? 'active' : ''}`}
            onClick={() => setExpenseModalTab && setExpenseModalTab('expense')}
          >
            ↗ Log Spend
          </button>
          <button
            type="button"
            className={`tab-btn ${isIncome ? 'active' : ''}`}
            onClick={() => setExpenseModalTab && setExpenseModalTab('income')}
          >
            ↙ Add Money (Income)
          </button>
        </div>

        {isIncome ? (
          <form onSubmit={addIncome}>
            <Field label="Source / Description">
              <input
                required
                value={form.expense.title}
                onChange={event => updateForm('expense', 'title', event.target.value)}
                placeholder="e.g. Pocket money, Birthday gift, Chore reward"
                autoFocus
              />
            </Field>
            <div className="form-grid">
              <Field label="Amount to add">
                <input
                  required
                  type="number"
                  min="1"
                  step="any"
                  value={form.expense.amount}
                  onChange={event => updateForm('expense', 'amount', event.target.value)}
                  placeholder="₹ 0"
                />
              </Field>
              <Field label="Category">
                <select
                  value={form.expense.category || 'Income'}
                  onChange={event => updateForm('expense', 'category', event.target.value)}
                >
                  <option>Income</option>
                  <option>Allowance</option>
                  <option>Gift</option>
                  <option>Side Gig</option>
                </select>
              </Field>
            </div>

            {accountingState.outstandingShortfall > 0 && (
              <div style={{ padding: '9px 12px', background: 'rgba(255, 77, 166, 0.1)', border: '1px solid rgba(255, 77, 166, 0.3)', borderRadius: '4px', marginBottom: '14px', fontSize: '11px', color: '#ffb3d9' }}>
                ⚡ <b>Auto-settlement active:</b> Incoming funds will automatically settle your <b>₹{accountingState.outstandingShortfall.toLocaleString('en-IN')}</b> outstanding shortfall first (FIFO). Any remaining funds will be credited to available cash.
              </div>
            )}

            <button className="primary-button full" type="submit">Add money to wallet (+5 ✦)</button>
          </form>
        ) : (
          <form onSubmit={addExpense}>
            <Field label="Description">
              <input
                required
                value={form.expense.title}
                onChange={event => updateForm('expense', 'title', event.target.value)}
                placeholder="e.g. Lunch with friends"
                autoFocus
              />
            </Field>
            <div className="form-grid">
              <Field label="Amount">
                <input
                  required
                  type="number"
                  min="1"
                  step="any"
                  value={form.expense.amount}
                  onChange={event => updateForm('expense', 'amount', event.target.value)}
                  placeholder="₹ 0"
                />
              </Field>
              <Field label="Category">
                <select
                  value={form.expense.category}
                  onChange={event => updateForm('expense', 'category', event.target.value)}
                >
                  <option>Essentials</option>
                  <option>Lifestyle</option>
                  <option>Impulse</option>
                </select>
              </Field>
            </div>

            <div style={{ marginBottom: '12px', fontSize: '11px', color: '#8c9b8e', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <span>Available balance: <b style={{ color: '#67ff3a' }}>₹{(accountingState.availableBalance || 0).toLocaleString('en-IN')}</b></span>
              {accountingState.outstandingShortfall > 0 && (
                <span style={{ color: '#ff4da6' }}>Outstanding shortfall: <b>₹{accountingState.outstandingShortfall.toLocaleString('en-IN')}</b></span>
              )}
            </div>

            <button className="primary-button full" type="submit">Save transaction (+2 ✦)</button>
          </form>
        )}
      </ModalShell>
    )
  }

  if (kind === 'split') {
    return (
      <CreateSplitModal
        closeModal={closeModal}
        onCreateSplit={onCreateSplit || addSplit}
        defaultUserName={profile?.name || 'You'}
      />
    )
  }

  if (kind === 'pool') {
    return (
      <ModalShell title="Create a money pool" kicker="CREW SAVINGS (+10 ✦)" closeModal={closeModal}>
        <form onSubmit={addPool}>
          <Field label="Pool name">
            <input
              required
              value={form.pool.name}
              onChange={event => updateForm('pool', 'name', event.target.value)}
              placeholder="e.g. Goa Trip Crew"
              autoFocus
            />
          </Field>
          <Field label="What are you saving for?">
            <input
              value={form.pool.purpose}
              onChange={event => updateForm('pool', 'purpose', event.target.value)}
              placeholder="Shared weekend trip"
            />
          </Field>
          <div className="form-grid">
            <Field label="Total target">
              <input
                required
                type="number"
                min="1"
                value={form.pool.target}
                onChange={event => updateForm('pool', 'target', event.target.value)}
                placeholder="₹ 0"
              />
            </Field>
            <Field label="Your target">
              <input
                type="number"
                min="0"
                value={form.pool.ownerTarget}
                onChange={event => updateForm('pool', 'ownerTarget', event.target.value)}
                placeholder="₹ 0"
              />
            </Field>
          </div>
          <Field label="Friends (comma separated)">
            <input
              value={form.pool.members}
              onChange={event => updateForm('pool', 'members', event.target.value)}
              placeholder="Riya, Sam, Dev"
            />
          </Field>
          <Field label="Deadline">
            <input
              type="date"
              value={form.pool.deadline}
              onChange={event => updateForm('pool', 'deadline', event.target.value)}
            />
          </Field>
          <button className="primary-button full" type="submit">Create pool (+10 ✦)</button>
        </form>
      </ModalShell>
    )
  }

  return (
    <ModalShell title="Make a money pitch" kicker="ASK PARENT (+5 ✦)" closeModal={closeModal}>
      <form onSubmit={addPitch}>
        <div className="form-grid">
          <Field label="Amount">
            <input
              required
              type="number"
              min="1"
              value={form.pitch.amount}
              onChange={event => updateForm('pitch', 'amount', event.target.value)}
              placeholder="₹ 0"
            />
          </Field>
          <Field label="For">
            <input
              required
              value={form.pitch.purpose}
              onChange={event => updateForm('pitch', 'purpose', event.target.value)}
              placeholder="Headphones"
            />
          </Field>
        </div>
        <Field label="Why do you need it?">
          <textarea
            required
            value={form.pitch.reason}
            onChange={event => updateForm('pitch', 'reason', event.target.value)}
            placeholder="Explain your plan..."
          />
        </Field>
        <Field label="Chores & responsibilities (comma separated — earn +25 ✦ each)">
          <input
            value={form.pitch.chores}
            onChange={event => updateForm('pitch', 'chores', event.target.value)}
            placeholder="Clean room, walk dog, wash car"
          />
        </Field>
        <Field label="Personal message">
          <textarea
            value={form.pitch.message}
            onChange={event => updateForm('pitch', 'message', event.target.value)}
            placeholder="I will make sure..."
          />
        </Field>
        <button className="primary-button full" type="submit">Generate parent link (+5 ✦)</button>
      </form>
    </ModalShell>
  )
}

function Field({ label, children }) {
  return <label>{label}{children}</label>
}

function ModalShell({ title, kicker, closeModal, children, className = '' }) {
  return (
    <div className={`modal-backdrop ${className ? `${className}-backdrop` : ''}`} onClick={closeModal}>
      <div className={`modal ${className}`} onClick={event => event.stopPropagation()}>
        <button className="close-modal" onClick={closeModal}>×</button>
        {kicker && <span className="section-kicker">{kicker}</span>}
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  )
}

export default App
