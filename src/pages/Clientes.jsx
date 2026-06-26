import React, { useEffect, useState } from 'react'
import api from '../services/api.js'

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [form, setForm] = useState({ razao_social:'', cnpj:'', email_responsavel:'', telefone:'', segmento:'' })
  const [mostraForm, setMostraForm] = useState(false)

  useEffect(() => { api.get('/clientes').then(r => setClientes(r.data)) }, [])

  async function salvar(e) {
    e.preventDefault()
    await api.post('/clientes', form)
    setMostraForm(false)
    api.get('/clientes').then(r => setClientes(r.data))
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Clientes ({clientes.length})</span>
          <button className="btn btn-primary" onClick={() => setMostraForm(!mostraForm)}>+ Novo cliente</button>
        </div>
        {mostraForm && (
          <form onSubmit={salvar} style={{ borderBottom:'0.5px solid var(--border)', paddingBottom:16, marginBottom:16 }}>
            <div className="grid-2">
              <div className="field"><label>Razão social</label><input required value={form.razao_social} onChange={e => setForm({...form, razao_social:e.target.value})} /></div>
              <div className="field"><label>CNPJ</label><input required value={form.cnpj} onChange={e => setForm({...form, cnpj:e.target.value})} placeholder="00.000.000/0001-00" /></div>
              <div className="field"><label>E-mail responsável</label><input required type="email" value={form.email_responsavel} onChange={e => setForm({...form, email_responsavel:e.target.value})} /></div>
              <div className="field"><label>Telefone</label><input value={form.telefone} onChange={e => setForm({...form, telefone:e.target.value})} /></div>
              <div className="field"><label>Segmento</label><input value={form.segmento} onChange={e => setForm({...form, segmento:e.target.value})} /></div>
            </div>
            <button className="btn btn-primary" type="submit">Salvar</button>
          </form>
        )}
        {clientes.map(c => (
          <div key={c.id} className="row-item">
            <div>
              <div className="row-name">{c.razao_social}</div>
              <div className="row-sub">CNPJ {c.cnpj} · {c.editais_ativos || 0} edital(is)</div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {c.docs_vencidos  > 0 && <span className="badge badge-danger">{c.docs_vencidos} vencido(s)</span>}
              {c.docs_vencendo > 0 && <span className="badge badge-warn">{c.docs_vencendo} vencendo</span>}
              {!c.docs_vencidos && !c.docs_vencendo && <span className="badge badge-ok">Regular</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
