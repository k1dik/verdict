import { useState, useEffect } from 'react'
import { G } from '../store/store.js'
import { Store } from '../store/store.js'

export default function ResultScreen() {
  const [data, setData] = useState(null)

  useEffect(() => {
    function refresh() {
      const hist = G.hist?.[0]
      if (!hist) return
      setData({
        outcome: { title: hist.title, type: hist.t },
        myChoice:    hist.my,
        theirChoice: hist.them,
        myDelta:     hist.d,
        rakeAmt:     hist.rake || 0,
        bal:         G.bal,
        mode:        G.mode,
        myName:      G.name,
        opp:         G.lastOpp,
        oppReal:     G.lastOppReal,
        insight:     G.hist?.[0]?.ins || '',
      })
    }

    refresh()
    const unsub = Store.subscribe('hist', refresh)
    return unsub
  }, [])

  if (!data) return null

  const { outcome, myChoice, theirChoice, myDelta, rakeAmt, bal, mode, myName, opp } = data

  const choiceColor = c => c === 'trust' ? 'var(--g)' : 'var(--r)'
  const deltaColor  = d => d >= 0 ? 'var(--g)' : 'var(--r)'
  const fmtDelta    = d => (d >= 0 ? '+$' : '-$') + Math.abs(d).toFixed(2)

  // Icon background based on outcome type
  const iconBg = outcome.type === 'win' ? 'var(--gd)' : outcome.type === 'loss' ? 'var(--rd)' : 'var(--yd)'
  const iconBorder = outcome.type === 'win' ? 'var(--g)' : outcome.type === 'loss' ? 'var(--r)' : 'var(--y)'
  const titleColor  = outcome.type === 'win' ? 'var(--g)' : outcome.type === 'loss' ? 'var(--r)' : 'var(--y)'

  const icons = { win: '✓', loss: '✗', mixed: '!' }

  return (
    <div style={{ padding: '20px 20px 0' }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '24px 0 28px', borderBottom: '1px solid var(--rim)' }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '20px',
          border: `1.5px solid ${iconBorder}`, background: iconBg,
          margin: '0 auto 18px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '34px', color: iconBorder,
        }}>
          {icons[outcome.type] || '?'}
        </div>
        <div style={{ fontSize: '34px', fontWeight: 700, letterSpacing: '-.05em', marginBottom: '8px', color: titleColor, fontFamily: 'var(--mono)' }}>
          {outcome.title}
        </div>
      </div>

      {/* Players */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--rim)' }}>
        <div style={{ padding: '20px', borderRight: '1px solid var(--rim)', textAlign: 'center' }}>
          <div className="lbl" style={{ marginBottom: '10px' }}>You</div>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            border: '1px solid var(--rim2)', margin: '0 auto 10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: 700, fontFamily: 'var(--mono)',
          }}>
            {(myName?.[0] || 'P').toUpperCase()}
          </div>
          <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '5px', fontFamily: 'var(--mono)', color: choiceColor(myChoice) }}>
            {myChoice?.toUpperCase()}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '16px', fontWeight: 700, color: deltaColor(myDelta) }}>
            {fmtDelta(myDelta)}
          </div>
        </div>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <div className="lbl" style={{ marginBottom: '10px' }}>
            {opp ? opp.name : 'Opponent'}
          </div>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            border: '1px solid var(--rim2)', background: 'var(--l1)',
            margin: '0 auto 10px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '14px', fontWeight: 700,
            fontFamily: 'var(--mono)', color: 'var(--t1)',
          }}>
            {(opp?.name?.[0] || '?').toUpperCase()}
          </div>
          <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '5px', fontFamily: 'var(--mono)', color: choiceColor(theirChoice) }}>
            {theirChoice?.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Rake */}
      {rakeAmt > 0 && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--rim)', padding: '12px 20px', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--t3)', fontFamily: 'var(--mono)' }}>Platform fee (5% of winnings)</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 700, color: 'var(--t3)' }}>-${rakeAmt.toFixed(2)}</span>
        </div>
      )}

      {/* Balance */}
      <div style={{ borderBottom: '1px solid var(--rim)', padding: '22px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="lbl" style={{ marginBottom: '6px' }}>{mode === 'real' ? 'Balance' : 'Demo Balance'}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--t3)', fontFamily: 'var(--mono)' }}>$</span>
            <span style={{ fontSize: '34px', fontWeight: 700, letterSpacing: '-.04em', fontFamily: 'var(--mono)' }}>{bal?.toFixed(2)}</span>
          </div>
        </div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: '15px', fontWeight: 700,
          padding: '10px 16px', border: `1.5px solid ${deltaColor(myDelta)}`,
          borderRadius: '10px', color: deltaColor(myDelta),
        }}>
          {fmtDelta(myDelta)}
        </div>
      </div>

      {/* Buttons */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button className="btn btn-p" onClick={() => window.playAgain()}>Play Another Round →</button>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-g" onClick={() => window.openShareOverlay()} style={{ flex: 1 }}>Share</button>
          <button className="btn btn-g" onClick={() => window.openChallengeSheet()} style={{ flex: 1 }}>⚔️ Challenge</button>
        </div>
        <button className="btn btn-g" onClick={() => window.goS('S-home')}>Home</button>
      </div>

    </div>
  )
}
