import express from 'express'
import multer from 'multer'
import { createClient } from '@supabase/supabase-js'
import { db } from '../db/index.js'

export const documentoRoutes = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

// Listar documentos de um cliente
documentoRoutes.get('/cliente/:clienteId', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT d.*, t.nome as tipo_nome, t.categoria
       FROM documentos_cliente d
       LEFT JOIN tipos_documento t ON t.id = d.tipo_documento_id
       WHERE d.cliente_id = $1
       ORDER BY d.status_validade, d.nome`,
      [req.params.clienteId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Upload de documento
documentoRoutes.post('/upload', upload.single('arquivo'), async (req, res) => {
  try {
    const { cliente_id, nome, tipo_documento_id, data_emissao, data_validade } = req.body
    const file = req.file

    let arquivo_url = null
    if (file) {
      const path = `documentos/${cliente_id}/${Date.now()}-${file.originalname}`
      const { error } = await supabase.storage.from('licitagest').upload(path, file.buffer, {
        contentType: file.mimetype
      })
      if (error) throw error
      arquivo_url = path
    }

    const { rows } = await db.query(
      `INSERT INTO documentos_cliente
         (cliente_id, nome, tipo_documento_id, arquivo_url, data_emissao, data_validade)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [cliente_id, nome, tipo_documento_id || null, arquivo_url, data_emissao || null, data_validade || null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Excluir documento
documentoRoutes.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM documentos_cliente WHERE id = $1', [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Listar tipos de documento
documentoRoutes.get('/tipos', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM tipos_documento WHERE ativo = true ORDER BY categoria, nome')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
