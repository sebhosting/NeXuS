'use client'
import { useAuth } from '@/lib/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg-base)'
    }}>
      <div style={{
        fontFamily: 'JetBrains Mono', color: 'var(--cyan)',
        letterSpacing: '3px', fontSize: '12px'
      }}>
        AUTHENTICATING...
      </div>
    </div>
  )

  if (!user) return null
  return <>{children}</>
}
