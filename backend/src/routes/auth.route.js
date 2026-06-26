import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../db/index.js'

export const authRoutes = express.Router()

// Login
authRoutes.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body
    const { rows } = await db.query(
      `SELECT u.*, c.razao_social as cliente_nome
       FROM usuarios u
       JOIN clientes c ON c.id = u.cliente_id
       WHERE u.email = $1 AND u.ativo = true`,
      [email]
    )
    const user = rows[0]
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' })

    const ok = await bcrypt.compare(senha, user.senha_hash)
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' })

    await db.query('UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = $1', [user.id])

    const token = jwt.sign(
      { id: user.id, cliente_id: user.cliente_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )
    res.json({ token, user: { id: user.id, nome: user.nome, email: user.email, role: user.role, cliente_nome: user.cliente_nome } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Registro do primeiro admin
authRoutes.post('/registro', async (req, res) => {
  try {
    const { nome, email, senha, razao_social, cnpj } = req.body
    const senha_hash = await bcrypt.hash(senha, 10)

    const { rows: [cliente] } = await db.query(
      `INSERT INTO clientes (razao_social, cnpj, email_responsavel)
       VALUES ($1, $2, $3) RETURNING id`,
      [razao_social, cnpj, email]
    )
    const { rows: [user] } = await db.query(
      `INSERT INTO usuarios (cliente_id, nome, email, senha_hash, role)
       VALUES ($1, $2, $3, $4, 'admin_plataforma') RETURNING id, nome, email, role`,
      [cliente.id, nome, email, senha_hash]
    )
    const token = jwt.sign(
      { id: user.id, cliente_id: cliente.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )
    res.status(201).json({ token, user })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})
