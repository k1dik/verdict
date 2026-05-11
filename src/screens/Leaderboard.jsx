import { useState, useEffect } from 'react'
import { G } from '../store/store.js'
import { lbLoad, lbUpsert } from './leaderboard.js'

const TABS = [
  { key: 'bal',   label: 'Balance' },
  { key: 'pnl',   label: 'P&L'     },
  { key: 'trust', label: 'Trust'   },
]

export default function Leaderboard() {
  const [tab,     setTab]     = useState('bal')
  const [entries, setEntries] = useState([])
  const [myRank,  setMyRank]  = useState(null)

  function refresh() {
    lbUpsert()
    const sorted = [...lbLoad()].sort((a, b) => {
      if (tab === 'bal')   return b.bal   - a.bal
      if (tab === 'pnl')   return b.pnl   - a.pnl
      if (tab === 'trust') return b.trust - a.trust
      return 0
    })
    const myIdx = sorted.findIndex(e => e.id === G.uid)
    setMyRank(myIdx >= 0 ? myIdx + 1 : null)
    setEntries(sorted.slice(0, 20))
  }

  // Пересчитываем при смене вкладки
  useEffect(() => { refresh() }, [tab])

  // Обновляемся когда Store меняется (после каждого раунда)
  useEffect(() => {
    const unsub = window.Store.subscribe('rounds', refresh)
    return unsub
  }, [tab])

  const scoreVal = (e) => {
    if (tab === 'bal')   return '$' + e.bal.toFixed(0)
    if (tab === 'pnl')   return (e.pnl >= 0 ? '+$' : '-$') + Math.abs(e.pnl).toFixed(0)
    return e.trust + '%'
  }

  const scoreColor = (e) => {
    if (tab === 'pnl')   return e.pnl   >= 0  ? 'var(--g)' : 'var(--r)'
    if (tab === 'trust') return e.trust >= 60 ? 'var(--g)' : e.trust >= 40 ? 'var(--y)' : 'var(--r)'
    return 'var(--t0)'
  }

  const rankSymbol = (i) => ['🥇','🥈','🥉'][i] ?? '#' + (i + 1)
  const rankClass  = (i) => ['gold','silver','bronze'][i] ?? ''

  return (
    <div>
      {/* Мой ранг */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--rim)', fontSize: '13px', color: 'var(--t2)' }}>
        Your rank: <span style={{ color: 'var(--r)', fontWeight: 700 }}>
          {myRank ? '#' + myRank : '#—'}
        </span>
      </div>

      {/* Вкладки */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--rim)' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '10px', background: 'none', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--r)' : '2px solid transparent',
              color: tab === t.key ? 'var(--r)' : 'var(--t3)',
              cursor: 'pointer', fontSize: '12px', fontWeight: 600,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Список */}
      {entries.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: '14px', color: 'var(--t3)', fontFamily: 'var(--mono)' }}>
          Play a round to appear here.
        </div>
      ) : (
        entries.map((e, i) => {
          const isMe = e.id === G.uid
          return (
            <div key={e.id} className="lb-row" style={{ background: isMe ? 'rgba(232,25,44,.04)' : '' }}>
              <div className={'lb-rank ' + rankClass(i)}>{rankSymbol(i)}</div>
              <div className={'lb-av' + (isMe ? ' me' : '')}>{(e.name[0] || '?').toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="lb-name">
                  {e.name}
                  {isMe && <span style={{ fontSize: '9px', color: 'var(--r)', fontFamily: 'var(--mono)' }}> (you)</span>}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--t3)', fontFamily: 'var(--mono)', marginTop: '2px' }}>
                  {e.rounds} rnd · {e.trust}% trust
                </div>
              </div>
              <div className="lb-score" style={{ color: scoreColor(e) }}>{scoreVal(e)}</div>
            </div>
          )
        })
      )}
    </div>
  )
}