import React, { useEffect, useState } from 'react'
import api from '../services/api.js'

export default function Agenda() {
  const [prazos, setPrazos] = useState([])

  useEffect(() => { api.get('/editais/agenda/proximos').then(r => setPrazos(r.data)) }, [])

  const cor = (u) => u==='urgente'?'badge-danger':u==='proximo'?'badge-warn':'badge-neutral'

  return (
    <div className="card">
      <div className="card-header"><span className="card-title">Próximos prazos</span></div>
      {prazos.map(p => (
        <div key={p.id} className="row-item">
          <div>
            <div className="row-name">{p.numero_edital} — {p.orgao}</div>
            <div className="row-sub">{p.cliente_nome} · {p.descricao || p.tipo_prazo?.replace('_',' ')}</div>
          </div>
          <span className={`badge ${cor(p.urgencia)}`}>{new Date(p.data_hora).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
        </div>
      ))}
      {prazos.length===0 && <p style={{color:'var(--text-2)',fontSize:13}}>Nenhum prazo cadastrado ainda.</p>}
    </div>
  )
}
