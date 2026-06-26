import React from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'

const navItems = [
  { label: 'Dashboard',      path: '/',           icon: '⊞', section: 'Principal' },
  { label: 'Clientes',       path: '/clientes',   icon: '👥', section: null },
  { label: 'Analisar edital',path: '/editais/novo',icon: '🤖', section: null },
  { label: 'Editais',        path: '/editais',    icon: '📄', section: null },
  { label: 'Documentos',     path: '/documentos', icon: '📁', section: 'Controle' },
  { label: 'Validação',      path: '/validacao',  icon: '✓',  section: null },
  { label: 'Agenda',         path: '/agenda',     icon: '📅', section: null },
]

export default function Layout() {
  const nav = useNavigate()
  const loc = useLocation()

  function logout() {
    localStorage.removeItem('token')
    nav('/login')
  }

  const titles = {
    '/': 'Dashboard', '/clientes': 'Clientes', '/editais': 'Editais',
    '/editais/novo': 'Analisar edital com IA', '/documentos': 'Documentos',
    '/validacao': 'Validação', '/agenda': 'Agenda'
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>LicitaGest</h1>
          <span>Gestão de licitações</span>
        </div>
        {navItems.map((item) => (
          <React.Fragment key={item.path}>
            {item.section && <div className="sidebar-section">{item.section}</div>}
            <div
              className={`nav-item ${loc.pathname === item.path ? 'active' : ''}`}
              onClick={() => nav(item.path)}
            >
              <span>{item.icon}</span> {item.label}
            </div>
          </React.Fragment>
        ))}
        <div style={{ flex: 1 }} />
        <div className="nav-item" onClick={logout} style={{ borderTop: '0.5px solid var(--border)', marginTop: 8 }}>
          ↩ Sair
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <h2>{titles[loc.pathname] || 'LicitaGest'}</h2>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, color: 'var(--accent)' }}>JP</div>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
