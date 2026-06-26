import React, { useEffect, useState } from 'react'
import api from '../services/api.js'

export default function Validacao() {
  const [editais, setEditais] = useState([])
  const [editalId, setEditalId] = useState('')
  const [detalhe, setDetalhe] = useState(null)

  useEffect(() => { api.get('/editais').then(r => { setEditais(r.data); if(r.data[0]) setEditalId(r.data[0].id) }) }, [])
  useEffect(() => { if(editalId) api.get(`/editais/${editalId}`).then(r => setDetalhe(r.data)) }, [editalId])

  const cor = (r) => r==='ok'?'badge-ok':r==='vencendo'?'badge-warn':'badge-danger'
  const bg  = (r) => r==='faltando'||r==='vencido'?'var(--danger-bg)':r==='vencendo'?'var(--warning-bg)':undefined
  const tc  = (r) => r==='faltando'||r==='vencido'?'var(--danger)':r==='vencendo'?'var(--warning)':undefined

  return (
    <>
      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <select style={{flex:1}} value={editalId} onChange={e => setEditalId(e.target.value)}>
          {editais.map(e => <option key={e.id} value={e.id}>{e.numero_edital} — {e.orgao}</option>)}
        </select>
      </div>
      {detalhe && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">{detalhe.numero_edital} — {detalhe.cliente_nome}</span>
            {detalhe.conformidade_pct != null && (
              <span className={`badge ${detalhe.conformidade_pct>=80?'badge-ok':detalhe.conformidade_pct>=50?'badge-warn':'badge-danger'}`}>{detalhe.conformidade_pct}% conforme</span>
            )}
          </div>
          {detalhe.validacoes?.length === 0 && <p style={{color:'var(--text-2)',fontSize:13}}>Validação pendente — aguarde o processamento da IA.</p>}
          {detalhe.validacoes?.map((v,i) => (
            <div key={i} className="row-item" style={{ background:bg(v.resultado), margin:'0 -16px', padding:'10px 16px' }}>
              <span style={{color:tc(v.resultado)}}>{v.tipo_documento_exigido}</span>
              <span className={`badge ${cor(v.resultado)}`}>{v.resultado}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
