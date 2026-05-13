import { useState, useEffect } from 'react'
import { G } from '../store/store.js'
import { lbUpsert } from './leaderboard.js'
import { supabase } from '../supabase.js'

const TABS = [
  { key: 'bal',   label: 'Balance' },
  { key: 'trust', label: 'Trust'   },
]

export default function Leaderboard() {
  const [tab,     setTab]     = useState('bal')
  const [entries, setEntries] = useState([])
  const [myRank,  setMyRank]  = useState(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    lbUpsert()

    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order(tab === 'trust' ? 'trust_rate' : 'bal', { ascending: false })
      .limit(50)

    if (error || !data) { setLoading(false); return; }

    const sorted = [...data].sort((a, b) => {
      if (tab === 'trust') return b.trust_rate - a.trust_rate
      return b.bal - a.bal
    })

    const myIdx = sorted.findIndex(e => e.player_id === G.userId)
    setMyRank(myIdx >= 0 ? myIdx + 1 : null)
    setEntries(sorted.slice(0, 20))
    setLoading(false)
  }

  useEffect(() => { refresh() }, [tab])

  useEffect(() => {
    if (window.Store) {
      const unsub = window.Store.subscribe('rounds', refresh)
      return unsub
    }
  }, [tab])

  const scoreVal = (e) => {
    if (tab === 'trust') return (e.trust_rate ?? 0) + '%'
    return '$' + (e.bal || 0).toFixed(2)
  }

  const scoreColor = (e) => {
    if (tab === 'trust') {
      const t = e.trust_rate ?? 0
      return t >= 60 ? 'var(--g)' : t >= 40 ? 'var(--y)' : 'var(--r)'
    }
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
      {loading ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: '13px', color: 'var(--t3)', fontFamily: 'var(--mono)' }}>
          Loading...
        </div>
      ) : entries.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: '14px', color: 'var(--t3)', fontFamily: 'var(--mono)' }}>
          No players yet. Play a round to appear here.
        </div>
      ) : (
        entries.map((e, i) => {
          const isMe  = e.player_id === G.userId
          const trust = e.trust_rate ?? 0
          return (
            <div key={e.player_id} className="lb-row" style={{ background: isMe ? 'rgba(232,25,44,.04)' : '' }}>
              <div className={'lb-rank ' + rankClass(i)}>{rankSymbol(i)}</div>
              <div className={'lb-av' + (isMe ? ' me' : '')}>{(e.name?.[0] || '?').toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="lb-name">
                  {e.name}
                  {isMe && <span style={{ fontSize: '9px', color: 'var(--r)', fontFamily: 'var(--mono)' }}> (you)</span>}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--t3)', fontFamily: 'var(--mono)', marginTop: '2px' }}>
                  {e.rounds} rnd · {trust}% trust
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
