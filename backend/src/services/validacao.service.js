import { db } from '../db/index.js'

export async function validarDocumentos(editalId, clienteId, requisitosIA) {
  const { rows: docsCliente } = await db.query(
    `SELECT * FROM documentos_cliente WHERE cliente_id = $1`,
    [clienteId]
  )

  const hoje = new Date()
  const em15dias = new Date(hoje.getTime() + 15 * 864e5)
  const resultados = []

  for (const req of requisitosIA.documentos_exigidos) {
    const n = req.nome.toLowerCase()

    // Busca match por nome (fuzzy simples)
    const doc = docsCliente.find(d => {
      const dn = d.nome.toLowerCase()
      const palavras = n.split(' ').filter(p => p.length > 3)
      return palavras.some(p => dn.includes(p))
    })

    let resultado = 'faltando'
    if (doc) {
      const validade = doc.data_validade ? new Date(doc.data_validade) : null
      if (!validade || validade > em15dias) resultado = 'ok'
      else if (validade > hoje)             resultado = 'vencendo'
      else                                  resultado = 'vencido'
    }

    resultados.push({ ...req, resultado, doc_id: doc?.id || null })

    // Salva no banco
    await db.query(
      `INSERT INTO validacoes_edital
         (edital_id, tipo_documento_exigido, resultado, documento_cliente_id)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT DO NOTHING`,
      [editalId, req.nome, resultado, doc?.id || null]
    )
  }

  const obrigatorios = resultados.filter(r => r.obrigatorio)
  const okCount = obrigatorios.filter(r => r.resultado === 'ok').length
  const conformidade = obrigatorios.length
    ? Math.round((okCount / obrigatorios.length) * 100)
    : 100

  // Atualiza conformidade no edital
  await db.query(
    'UPDATE editais SET conformidade_pct = $1 WHERE id = $2',
    [conformidade, editalId]
  )

  return {
    resultados,
    conformidade,
    criticos: resultados.filter(r => ['faltando', 'vencido'].includes(r.resultado)),
    atencao:  resultados.filter(r => r.resultado === 'vencendo')
  }
}
