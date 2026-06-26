import express from 'express'
import { db } from '../db/index.js'

export const clienteRoutes = express.Router()

// Listar clientes
clienteRoutes.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT * FROM painel_clientes ORDER BY razao_social`)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Criar cliente
clienteRoutes.post('/', async (req, res) => {
  try {
    const { razao_social, cnpj, email_responsavel, telefone, segmento } = req.body
    const { rows } = await db.query(
      `INSERT INTO clientes (razao_social, cnpj, email_responsavel, telefone, segmento)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [razao_social, cnpj, email_responsavel, telefone, segmento]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Buscar cliente por ID
clienteRoutes.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM clientes WHERE id = $1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Cliente não encontrado' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Atualizar cliente
clienteRoutes.put('/:id', async (req, res) => {
  try {
    const { razao_social, cnpj, email_responsavel, telefone, segmento, status } = req.body
    const { rows } = await db.query(
      `UPDATE clientes SET razao_social=$1, cnpj=$2, email_responsavel=$3,
       telefone=$4, segmento=$5, status=$6 WHERE id=$7 RETURNING *`,
      [razao_social, cnpj, email_responsavel, telefone, segmento, status, req.params.id]
    )
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
