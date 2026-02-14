'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useRouter } from 'next/navigation'

export default function Topbar() {
  const [time, setTime] = useState('')
  const { user, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', {
      hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit'
    }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const handleLogout = async () => {
    await logout()
    router.replace('/login')
  }

  return (
    <header style={{
      height:'52px', background:'var(--bg-surface)',
      borderBottom:'1px solid var(--border)',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0 24px', flexShrink:0,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        <span style={{ color:'var(--text-dim)', fontSize:'12px', letterSpacing:'2px', fontWeight:600 }}>CONTROL PANEL</span>
        <span style={{ color:'var(--border)', fontSize:'12px' }}>/</span>
        <span style={{ color:'var(--cyan)', fontSize:'12px', letterSpacing:'2px', fontWeight:600 }}>DASHBOARD</span>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:'24px' }}>
        {[{label:'TRAEFIK',ok:true},{label:'POSTGRES',ok:true},{label:'REDIS',ok:true}].map(s => (
          <div key={s.label} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <div style={{ width:'6px', height:'6px', borderRadius:'50%',
              background:s.ok?'var(--green)':'var(--red)',
              boxShadow:`0 0 6px ${s.ok?'var(--green)':'var(--red)'}`,
              animation:'pulse 2s infinite',
            }} />
            <span style={{ fontFamily:'JetBrains Mono', fontSize:'10px', color:'var(--text-muted)', letterSpacing:'1px' }}>
              {s.label}
            </span>
          </div>
        ))}

        <div style={{ fontFamily:'JetBrains Mono', fontSize:'13px', color:'var(--cyan)', letterSpacing:'2px', minWidth:'80px', textAlign:'right' }}>
          {time}
        </div>

        {/* User badge */}
        {user && (
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontFamily:'Rajdhani', fontSize:'12px', fontWeight:700, color:'var(--text-primary)', letterSpacing:'1px' }}>
                {user.username.toUpperCase()}
              </div>
              <div style={{ fontFamily:'JetBrains Mono', fontSize:'9px', color:user.role==='admin'?'var(--cyan)':'var(--text-muted)', letterSpacing:'1px' }}>
                {user.role.toUpperCase()}
              </div>
            </div>
            <button onClick={handleLogout}
              style={{
                width:'30px', height:'30px',
                background:'var(--bg-card)', border:'1px solid var(--border)',
                borderRadius:'4px', cursor:'pointer', color:'var(--text-muted)',
                fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center',
                transition:'all 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--red)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--red)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
              }}
              title="Logout"
            >
              ⏻
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
