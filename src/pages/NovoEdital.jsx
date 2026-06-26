import React, { useState, useEffect } from 'react'
import api from '../services/api.js'

export default function NovoEdital() {
  const [clientes, setClientes]     = useState([])
  const [clienteId, setClienteId]   = useState('')
  const [numero, setNumero]         = useState('')
  const [orgao, setOrgao]           = useState('')
  const [texto, setTexto]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [etapa, setEtapa]           = useState(0) // 0=form 1=processando 2=resultado
  const [resultado, setResultado]   = useState(null)
  const [jobId, setJobId]           = useState(null)
  const [progresso, setProgresso]   = useState(0)

  useEffect(() => {
    api.get('/clientes').then(r => {
      setClientes(r.data)
      if (r.data[0]) setClienteId(r.data[0].id)
    })
  }, [])

  // Polling do job
  useEffect(() => {
    if (!jobId) return
    const iv = setInterval(async () => {
      try {
        const { data } = await api.get(`/editais/job/${jobId}`)
        setProgresso(data.progress || 0)
        if (data.state === 'completed') {
          clearInterval(iv)
          const { data: edital } = await api.get(`/editais/${data.data.editalId}`)
          setResultado(edital)
          setEtapa(2)
        }
        if (data.state === 'failed') { clearInterval(iv); setEtapa(0); alert('Erro no processamento.') }
      } catch { clearInterval(iv) }
    }, 2000)
    return () => clearInterval(iv)
  }, [jobId])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!texto.trim()) return alert('Cole o texto do edital.')
    setLoading(true)
    setEtapa(1)
    setProgresso(0)
    try {
      const { data } = await api.post('/editais/analisar-texto', {
        cliente_id: clienteId, numero_edital: numero, orgao, texto
      })
      setJobId(data.jobId)
    } catch (err) {
      alert('Erro: ' + (err.response?.data?.error || err.message))
      setEtapa(0)
    } finally {
      setLoading(false)
    }
  }

  const statusCor = (r) => {
    if (r === 'ok') return 'tag-ok'
    if (r === 'vencido' || r === 'faltando') return 'tag-err'
    return 'tag-warn'
  }

  if (etapa === 2 && resultado) return (
    <div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Análise concluída — {resultado.numero_edital}</span>
          <span className="badge badge-ok">✓ Processado</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <span className="badge badge-info">{resultado.orgao}</span>
          <span className="badge badge-neutral">{resultado.modalidade?.replace('_', ' ')}</span>
          {resultado.valor_estimado && (
            <span className="badge badge-neutral">R$ {Number(resultado.valor_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          )}
        </div>
        {resultado.objeto && <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>{resultado.objeto}</p>}

        {resultado.requisitos?.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>Documentos exigidos ({resultado.requisitos.length})</div>
            <div style={{ marginBottom: 14 }}>
              {resultado.requisitos.map((r, i) => (
                <span key={i} className="tag tag-ok">✓ {r.nome_documento}</span>
              ))}
            </div>
          </>
        )}

        {resultado.prazos?.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 6 }}>Prazos identificados</div>
            {resultado.prazos.map((p, i) => (
              <div key={i} className="row-item">
                <span>{p.descricao}</span>
                <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>{new Date(p.data_hora).toLocaleString('pt-BR')}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {resultado.validacoes?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Validação automática</span>
            <span className={`badge ${resultado.conformidade_pct >= 80 ? 'badge-ok' : resultado.conformidade_pct >= 50 ? 'badge-warn' : 'badge-danger'}`}>
              {resultado.conformidade_pct}% conforme
            </span>
          </div>
          {resultado.validacoes.map((v, i) => (
            <div key={i} className="row-item"
              style={{ background: v.resultado === 'faltando' || v.resultado === 'vencido' ? 'var(--danger-bg)' : v.resultado === 'vencendo' ? 'var(--warning-bg)' : undefined, margin: '0 -16px', padding: '10px 16px' }}>
              <span style={{ color: v.resultado === 'faltando' || v.resultado === 'vencido' ? 'var(--danger)' : v.resultado === 'vencendo' ? 'var(--warning)' : undefined }}>{v.tipo_documento_exigido}</span>
              <span className={`badge ${statusCor(v.resultado)}`}>{v.resultado}</span>
            </div>
          ))}
        </div>
      )}
      <button className="btn btn-ghost" onClick={() => { setEtapa(0); setResultado(null); setJobId(null) }}>← Analisar outro edital</button>
    </div>
  )

  if (etapa === 1) return (
    <div className="card">
      <div className="card-header"><span className="card-title">Processando edital</span><span className="badge badge-info">Aguarde...</span></div>
      {[
        { label: 'Leitura do texto', done: progresso >= 20 },
        { label: 'Análise com Claude IA', done: progresso >= 70, active: progresso >= 20 && progresso < 70 },
        { label: 'Validação cruzada', done: progresso >= 90, active: progresso >= 70 && progresso < 90 },
        { label: 'Concluído', done: progresso >= 100, active: progresso >= 90 && progresso < 100 },
      ].map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, background: s.done ? 'var(--success-bg)' : s.active ? 'var(--accent-bg)' : 'var(--bg)', color: s.done ? 'var(--success)' : s.active ? 'var(--accent)' : 'var(--text-3)', border: '0.5px solid var(--border)' }}>
            {s.done ? '✓' : i + 1}
          </div>
          <span style={{ fontSize: 13, color: s.done || s.active ? 'var(--text)' : 'var(--text-3)' }}>{s.label}</span>
        </div>
      ))}
      <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2, marginTop: 14, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 2, width: progresso + '%', transition: 'width .4s' }} />
      </div>
    </div>
  )

  return (
    <form onSubmit={handleSubmit}>
      <div className="alert alert-info">Cole o texto de um edital real. A IA extrai documentos, prazos e valor automaticamente.</div>
      <div className="card">
        <div className="grid-2">
          <div className="field">
            <label>Cliente</label>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} required>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Número do edital</label>
            <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex: 042/2025" required />
          </div>
        </div>
        <div className="field">
          <label>Órgão licitante</label>
          <input value={orgao} onChange={e => setOrgao(e.target.value)} placeholder="Ex: Prefeitura de São Paulo" required />
        </div>
        <div className="field">
          <label>Texto do edital</label>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={10} placeholder="Cole aqui o conteúdo completo do edital..." required />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>🤖 Analisar com IA</button>
      </div>
    </form>
  )
}
