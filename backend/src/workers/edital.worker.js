import 'dotenv/config'
import pdfParse from 'pdf-parse'
import { createClient } from '@supabase/supabase-js'
import { editalQueue } from '../queues/edital.queue.js'
import { analisarComIA } from '../services/ia.service.js'
import { validarDocumentos } from '../services/validacao.service.js'
import { notificarPendencias, agendarLembretePrazo } from '../services/notificacao.service.js'
import { db } from '../db/index.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function processarEdital(job) {
  const { editalId, clienteId, arquivoUrl, texto } = job.data
  console.log(`[WORKER] Processando edital ${editalId}`)

  try {
    await db.query(`UPDATE editais SET status='processando' WHERE id=$1`, [editalId])
    await job.progress(10)

    // Etapa 1: Extração de texto
    let textoEdital = texto
    if (!textoEdital && arquivoUrl) {
      const { data, error } = await supabase.storage.from('licitagest').download(arquivoUrl)
      if (error) throw error
      const buffer = Buffer.from(await data.arrayBuffer())
      const parsed = await pdfParse(buffer)
      textoEdital = parsed.text
      await db.query(`UPDATE editais SET conteudo_extraido=$1 WHERE id=$2`, [textoEdital, editalId])
    }
    await job.progress(30)

    // Etapa 2: Análise com IA
    const { resultado, tokens_usados } = await analisarComIA(textoEdital)
    await job.progress(60)

    // Persiste resultado da IA
    await db.query(
      `UPDATE editais SET requisitos_ia=$1, orgao=$2, objeto=$3, modalidade=$4,
       valor_estimado=$5, status='analisado' WHERE id=$6`,
      [JSON.stringify(resultado), resultado.orgao, resultado.objeto,
       resultado.modalidade, resultado.valor_estimado || null, editalId]
    )

    // Salva log da análise
    await db.query(
      `INSERT INTO analises_ia (edital_id, modelo_usado, resultado_raw, tokens_usados, status)
       VALUES ($1,'claude-sonnet-4-6',$2,$3,'concluido')`,
      [editalId, JSON.stringify(resultado), tokens_usados]
    )
    await job.progress(70)

    // Etapa 3: Salva requisitos extraídos
    for (const doc of resultado.documentos_exigidos || []) {
      await db.query(
        `INSERT INTO requisitos_edital (edital_id, nome_documento, categoria, obrigatorio)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [editalId, doc.nome, doc.tipo, doc.obrigatorio]
      )
    }

    // Etapa 4: Salva prazos
    for (const prazo of resultado.prazos || []) {
      const { rows: [p] } = await db.query(
        `INSERT INTO prazos_edital (edital_id, tipo_prazo, data_hora, descricao)
         VALUES ($1,$2::tipo_prazo,$3,$4) RETURNING id`,
        [editalId, prazo.tipo, prazo.data_hora, prazo.descricao]
      )
      if (p) await agendarLembretePrazo(clienteId, editalId, { ...prazo, id: p.id })
    }
    await job.progress(80)

    // Etapa 5: Validação cruzada com docs do cliente
    const validacao = await validarDocumentos(editalId, clienteId, resultado)
    await job.progress(90)

    // Etapa 6: Notificações
    const { rows: [cliente] } = await db.query('SELECT * FROM clientes WHERE id=$1', [clienteId])
    const { rows: [edital] }  = await db.query('SELECT * FROM editais WHERE id=$1', [editalId])
    if (validacao.criticos.length || validacao.atencao.length) {
      await notificarPendencias(cliente, edital, validacao)
    }

    await db.query(`UPDATE editais SET status='em_andamento' WHERE id=$1`, [editalId])
    await job.progress(100)
    console.log(`[WORKER] Edital ${editalId} processado — conformidade: ${validacao.conformidade}%`)

  } catch (err) {
    console.error(`[WORKER] Erro no edital ${editalId}:`, err.message)
    await db.query(`UPDATE editais SET status='aguardando' WHERE id=$1`, [editalId])
    await db.query(
      `INSERT INTO analises_ia (edital_id, modelo_usado, status, erro_mensagem)
       VALUES ($1,'claude-sonnet-4-6','falhou',$2)`,
      [editalId, err.message]
    )
    throw err
  }
}

editalQueue.process('analisar',       processarEdital)
editalQueue.process('analisar-texto', processarEdital)

editalQueue.on('completed', (job) => console.log(`[QUEUE] Job ${job.id} concluído`))
editalQueue.on('failed',    (job, err) => console.error(`[QUEUE] Job ${job.id} falhou:`, err.message))

console.log('[WORKER] Aguardando jobs...')
