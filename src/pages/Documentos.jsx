import React, { useEffect, useState } from 'react'
import api from '../services/api.js'

export default function Documentos() {
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState('')
  const [docs, setDocs] = useState([])
  const [tipos, setTipos] = useState([])
  const [form, setForm] = useState({ nome:'', tipo_documento_id:'', data_emissao:'', data_validade:'' })
  const [arquivo, setArquivo] = useState(null)
  const [mostraForm, setMostraForm] = useState(false)

  useEffect(() => {
    api.get('/clientes').then(r => { setClientes(r.data); if(r.data[0]) setClienteId(r.data[0].id) })
    api.get('/documentos/tipos').then(r => setTipos(r.data))
  }, [])

  useEffect(() => {
    if (clienteId) api.get(`/documentos/cliente/${clienteId}`).then(r => setDocs(r.data))
  }, [clienteId])

  async function salvar(e) {
    e.preventDefault()
    const fd = new FormData()
    Object.entries({ ...form, cliente_id: clienteId }).forEach(([k,v]) => fd.append(k, v))
    if (arquivo) fd.append('arquivo', arquivo)
    await api.post('/documentos/upload', fd, { headers: { 'Content-Type':'multipart/form-data' } })
    setMostraForm(false)
    api.get(`/documentos/cliente/${clienteId}`).then(r => setDocs(r.data))
  }

  const corStatus = (s) => s==='valido'?'badge-ok':s==='vencendo'?'badge-warn':s==='vencido'?'badge-danger':'badge-neutral'

  return (
    <>
      <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center' }}>
        <select style={{ width:240 }} value={clienteId} onChange={e => setClienteId(e.target.value)}>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
        </select>
        <button className="btn btn-primary" onClick={() => setMostraForm(!mostraForm)}>+ Enviar documento</button>
      </div>
      {mostraForm && (
        <div className="card">
          <form onSubmit={salvar}>
            <div className="grid-2">
              <div className="field"><label>Nome do documento</label><input required value={form.nome} onChange={e => setForm({...form, nome:e.target.value})} /></div>
              <div className="field"><label>Tipo</label>
                <select value={form.tipo_documento_id} onChange={e => setForm({...form, tipo_documento_id:e.target.value})}>
                  <option value="">Selecione...</option>
                  {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
              <div className="field"><label>Data de emissão</label><input type="date" value={form.data_emissao} onChange={e => setForm({...form, data_emissao:e.target.value})} /></div>
              <div className="field"><label>Data de validade</label><input type="date" value={form.data_validade} onChange={e => setForm({...form, data_validade:e.target.value})} /></div>
            </div>
            <div className="field"><label>Arquivo PDF</label><input type="file" accept=".pdf" onChange={e => setArquivo(e.target.files[0])} /></div>
            <button className="btn btn-primary" type="submit">Salvar documento</button>
          </form>
        </div>
      )}
      <div className="grid-2">
        <div className="card">
          <div className="card-header"><span className="card-title">Válidos</span><span className="badge badge-ok">{docs.filter(d=>d.status_validade==='valido').length}</span></div>
          {docs.filter(d=>d.status_validade==='valido'||d.status_validade==='sem_validade').map(d => (
            <div key={d.id} className="row-item"><span>{d.nome}</span><span className={`badge ${corStatus(d.status_validade)}`}>{d.data_validade ? new Date(d.data_validade).toLocaleDateString('pt-BR') : 'Sem validade'}</span></div>
          ))}
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Pendências</span><span className="badge badge-danger">{docs.filter(d=>d.status_validade==='vencido'||d.status_validade==='vencendo').length}</span></div>
          {docs.filter(d=>d.status_validade==='vencido'||d.status_validade==='vencendo').map(d => (
            <div key={d.id} className="row-item"><span style={{color: d.status_validade==='vencido'?'var(--danger)':'var(--warning)'}}>{d.nome}</span><span className={`badge ${corStatus(d.status_validade)}`}>{d.status_validade}</span></div>
          ))}
          {docs.filter(d=>d.status_validade==='vencido'||d.status_validade==='vencendo').length===0 && <p style={{color:'var(--text-2)',fontSize:13,padding:'8px 0'}}>Sem pendências.</p>}
        </div>
      </div>
    </>
  )
}
