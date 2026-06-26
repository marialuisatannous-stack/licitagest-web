import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api.js'

export default function Editais() {
  const [editais, setEditais] = useState([])
  const nav = useNavigate()

  useEffect(() => { api.get('/editais').then(r => setEditais(r.data)) }, [])

  const cor = (s) => s === 'em_andamento' ? 'badge-ok' : s === 'processando' ? 'badge-warn' : 'badge-neutral'

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Editais ({editais.length})</span>
        <button className="btn btn-primary" onClick={() => nav('/editais/novo')}>+ Novo edital</button>
      </div>
      {editais.map(e => (
        <div key={e.id} className="row-item">
          <div>
            <div className="row-name">{e.numero_edital} — {e.orgao}</div>
            <div className="row-sub">{e.cliente_nome} {e.valor_estimado ? `· R$ ${Number(e.valor_estimado).toLocaleString('pt-BR')}` : ''}</div>
          </div>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            {e.conformidade_pct != null && (
              <span className={`badge ${e.conformidade_pct >= 80 ? 'badge-ok' : e.conformidade_pct >= 50 ? 'badge-warn' : 'badge-danger'}`}>{e.conformidade_pct}%</span>
            )}
            <span className={`badge ${cor(e.status)}`}>{e.status?.replace('_',' ')}</span>
          </div>
        </div>
      ))}
      {editais.length === 0 && <p style={{ color:'var(--text-2)', fontSize:13 }}>Nenhum edital cadastrado ainda.</p>}
    </div>
  )
}
