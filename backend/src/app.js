import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { editalRoutes } from './routes/editais.route.js'
import { clienteRoutes } from './routes/clientes.route.js'
import { documentoRoutes } from './routes/documentos.route.js'
import { authRoutes } from './routes/auth.route.js'
import { authMiddleware } from './middlewares/auth.middleware.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({ origin: process.env.APP_URL || '*' }))
app.use(express.json())

// Rotas públicas
app.use('/api/auth', authRoutes)

// Rotas protegidas
app.use('/api/editais',    authMiddleware, editalRoutes)
app.use('/api/clientes',   authMiddleware, clienteRoutes)
app.use('/api/documentos', authMiddleware, documentoRoutes)

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date() }))

app.listen(PORT, () => console.log(`API rodando na porta ${PORT}`))
export default app
