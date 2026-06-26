import express from 'express'
import multer from 'multer'
import { createClient } from '@supabase/supabase-js'
import { db } from '../db/index.js'
import { editalQueue } from '../queues/edital.queue.js'

export const editalRoutes = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

// Listar editais
editalRoutes.get('/', async (req, res) => {
  try {
    const { cliente_id } = req.query
    const where = cliente_id ? 'WHERE e.cliente_id = $1' : ''
    const params = cliente_id ? [cliente_id] : []
    const { rows } = await db.query(
      `SELECT e.*, c.razao_social as cliente_nome,
         (SELECT COUNT(*) FROM prazos_edital p WHERE p.edital_id = e.id AND p.concluido = false) as prazos_ativos
       FROM editais e
       JOIN clientes c ON c.id = e.cliente_id
       ${where}
       ORDER BY e.created_at DESC`,
      params
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Buscar edital por ID com validações e prazos
editalRoutes.get('/:id', async (req, res) => {
  try {
    const { rows: [edital] } = await db.query(
      `SELECT e.*, c.razao_social as cliente_nome, c.email_responsavel, c.telefone
       FROM editais e JOIN clientes c ON c.id = e.cliente_id
       WHERE e.id = $1`, [req.params.id]
    )
    if (!edital) return res.status(404).json({ error: 'Edital não encontrado' })

    const { rows: prazos } = await db.query(
      'SELECT * FROM prazos_edital WHERE edital_id = $1 ORDER BY data_hora', [req.params.id])
    const { rows: validacoes } = await db.query(
      'SELECT * FROM validacoes_edital WHERE edital_id = $1', [req.params.id])
    const { rows: requisitos } = await db.query(
      'SELECT * FROM requisitos_edital WHERE edital_id = $1', [req.params.id])

    res.json({ ...edital, prazos, validacoes, requisitos })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Upload de edital PDF → enfileira análise
editalRoutes.post('/upload', upload.single('edital'), async (req, res) => {
  try {
    const { cliente_id, numero_edital, orgao } = req.body
    const file = req.file

    // Salva PDF no Supabase Storage
    let arquivo_url = null
    if (file) {
      const path = `editais/${cliente_id}/${Date.now()}-${file.originalname}`
      const { error } = await supabase.storage.from('licitagest').upload(path, file.buffer, {
        contentType: 'application/pdf'
      })
      if (error) throw error
      arquivo_url = path
    }

    // Cria registro do edital
    const { rows: [edital] } = await db.query(
      `INSERT INTO editais (cliente_id, numero_edital, orgao, arquivo_original_url, status)
       VALUES ($1,$2,$3,$4,'processando') RETURNING *`,
      [cliente_id, numero_edital, orgao, arquivo_url]
    )

    // Enfileira job de análise com IA
    const job = await editalQueue.add('analisar', {
      editalId: edital.id,
      clienteId: cliente_id,
      arquivoUrl: arquivo_url
    })

    res.status(201).json({ edital, jobId: job.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Analisar via texto (sem PDF)
editalRoutes.post('/analisar-texto', async (req, res) => {
  try {
    const { cliente_id, numero_edital, orgao, texto } = req.body

    const { rows: [edital] } = await db.query(
      `INSERT INTO editais (cliente_id, numero_edital, orgao, conteudo_extraido, status)
       VALUES ($1,$2,$3,$4,'processando') RETURNING *`,
      [cliente_id, numero_edital, orgao, texto]
    )
    const job = await editalQueue.add('analisar-texto', {
      editalId: edital.id,
      clienteId: cliente_id,
      texto
    })
    res.status(201).json({ edital, jobId: job.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Status de um job
editalRoutes.get('/job/:jobId', async (req, res) => {
  try {
    const job = await editalQueue.getJob(req.params.jobId)
    if (!job) return res.status(404).json({ error: 'Job não encontrado' })
    const state = await job.getState()
    const progress = job.progress()
    res.json({ jobId: job.id, state, progress, data: job.data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Próximos prazos (agenda)
editalRoutes.get('/agenda/proximos', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM proximos_prazos
       WHERE data_hora >= NOW()
       LIMIT 30`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
