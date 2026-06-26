import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api.js'

export default function Dashboard() {
  const [clientes, setClientes] = useState([])
  const [prazos, setPrazos]   = useState([])
  const nav = useNavigate()

  useEffect(() => {
    api.get('/clientes').then(r => setClientes(r.data)).catch(() => {})
    api.get('/editais/agenda/proximos').then(r => setPrazos(r.data)).catch(() => {})
  }, [])

  const docsVencendo = clientes.reduce((s, c) => s + (c.docs_vencendo || 0), 0)
  const docsVencidos = clientes.reduce((s, c) => s + (c.docs_vencidos  || 0), 0)
  const editaisAtivos = clientes.reduce((s, c) => s + (c.editais_ativos || 0), 0)

  function urgencia(p) {
    if (p.urgencia === 'urgente') return 'badge-danger'
    if (p.urgencia === 'proximo') return 'badge-warn'
    return 'badge-neutral'
  }

  return (
    <>
      <div className="grid-4">
        <div className="metric"><div className="metric-label">Clientes</div><div className="metric-value">{clientes.length}</div></div>
        <div className="metric"><div className="metric-label">Editais ativos</div><div className="metric-value">{editaisAtivos}</div></div>
        <div className="metric"><div className="metric-label">Docs vencendo</div><div className="metric-value" style={{ color: docsVencendo > 0 ? 'var(--warning)' : undefined }}>{docsVencendo}</div></div>
        <div className="metric"><div className="metric-label">Docs vencidos</div><div className="metric-value" style={{ color: docsVencidos > 0 ? 'var(--danger)' : undefined }}>{docsVencidos}</div></div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Clientes com pendências</span>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => nav('/clientes')}>Ver todos</button>
          </div>
          {clientes.filter(c => c.docs_vencidos > 0 || c.docs_vencendo > 0).slice(0, 5).map(c => (
            <div className="row-item" key={c.id}>
              <div>
                <div className="row-name">{c.razao_social}</div>
                <div className="row-sub">{c.editais_ativos} edital(is) ativo(s)</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {c.docs_vencidos  > 0 && <span className="badge badge-danger">{c.docs_vencidos} vencido(s)</span>}
                {c.docs_vencendo > 0 && <span className="badge badge-warn">{c.docs_vencendo} vencendo</span>}
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => nav('/validacao')}>Ver</button>
              </div>
            </div>
          ))}
          {clientes.filter(c => c.docs_vencidos > 0 || c.docs_vencendo > 0).length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-2)', padding: '8px 0' }}>Nenhuma pendência no momento.</p>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Próximos pregões</span>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => nav('/agenda')}>Agenda</button>
          </div>
          {prazos.slice(0, 5).map(p => (
            <div className="row-item" key={p.id}>
              <div>
                <div className="row-name">{p.numero_edital} — {p.orgao}</div>
                <div className="row-sub">{p.cliente_nome} · {p.descricao}</div>
              </div>
              <span className={`badge ${urgencia(p)}`}>{new Date(p.data_hora).toLocaleDateString('pt-BR')}</span>
            </div>
          ))}
          {prazos.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-2)', padding: '8px 0' }}>Nenhum prazo nos próximos dias.</p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Ação rápida</span></div>
        <button className="btn btn-primary" onClick={() => nav('/editais/novo')}>🤖 Analisar novo edital com IA</button>
      </div>
    </>
  )
}
