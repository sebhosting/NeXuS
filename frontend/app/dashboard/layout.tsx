'use client'
import ProtectedRoute from '@/components/ProtectedRoute'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <Topbar />
          <main className="flex-1 overflow-auto p-6" style={{ background: 'var(--bg-base)' }}>
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
