import { Resend } from 'resend'
import cron from 'node-cron'
import { db } from '../db/index.js'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function notificarPendencias(cliente, edital, validacao) {
  const { criticos, atencao } = validacao
  if (!criticos.length && !atencao.length) return

  const listaHTML = [
    ...criticos.map(d => `<li style="color:#c0392b">⚠ <b>${d.nome}</b> — ${d.resultado === 'faltando' ? 'não enviado' : 'VENCIDO'}</li>`),
    ...atencao.map(d =>  `<li style="color:#e67e22">⏰ <b>${d.nome}</b> — vencendo em breve</li>`)
  ].join('')

  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'noreply@licitagest.com.br',
    to: cliente.email_responsavel,
    subject: `⚠ LicitaGest: ${criticos.length} pendência(s) crítica(s) — ${edital.numero_edital}`,
    html: `
      <h2>Pendências no Pregão ${edital.numero_edital}</h2>
      <p>Órgão: <b>${edital.orgao}</b></p>
      <p>Cliente: <b>${cliente.razao_social}</b></p>
      <h3>Documentos com problemas:</h3>
      <ul>${listaHTML}</ul>
      <p>Conformidade atual: <b>${validacao.conformidade}%</b></p>
      <p><a href="${process.env.APP_URL}/editais/${edital.id}">Acessar plataforma →</a></p>
    `
  })

  // Registra notificação no banco
  await db.query(
    `INSERT INTO notificacoes (cliente_id, edital_id, tipo, canal, status_envio, enviado_em)
     VALUES ($1,$2,'doc_faltando','email','enviado',NOW())`,
    [cliente.id, edital.id]
  )
}

export async function agendarLembretePrazo(clienteId, editalId, prazo) {
  const lembrete = new Date(prazo.data_hora)
  lembrete.setDate(lembrete.getDate() - 3)

  await db.query(
    `INSERT INTO notificacoes (cliente_id, edital_id, prazo_id, tipo, canal, status_envio, agendar_para)
     VALUES ($1,$2,$3,'lembrete_prazo','email','agendado',$4)`,
    [clienteId, editalId, prazo.id, lembrete]
  )
}

// Cron: roda todo dia às 08h — dispara lembretes agendados
export function iniciarCron() {
  cron.schedule('0 8 * * *', async () => {
    console.log('[CRON] Verificando lembretes agendados...')
    const { rows } = await db.query(
      `SELECT n.*, c.email_responsavel, c.razao_social, e.numero_edital, e.orgao
       FROM notificacoes n
       JOIN clientes c ON c.id = n.cliente_id
       JOIN editais  e ON e.id = n.edital_id
       WHERE n.status_envio = 'agendado'
         AND n.agendar_para::date <= CURRENT_DATE`
    )
    for (const n of rows) {
      try {
        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'noreply@licitagest.com.br',
          to: n.email_responsavel,
          subject: `Lembrete: ${n.numero_edital} — sessão em 3 dias`,
          html: `<p>Olá, ${n.razao_social}!</p>
                 <p>O pregão <b>${n.numero_edital}</b> (${n.orgao}) ocorre em 3 dias.</p>
                 <p><a href="${process.env.APP_URL}">Acessar plataforma →</a></p>`
        })
        await db.query(
          `UPDATE notificacoes SET status_envio='enviado', enviado_em=NOW() WHERE id=$1`,
          [n.id]
        )
      } catch (err) {
        console.error(`Falha ao enviar lembrete ${n.id}:`, err.message)
        await db.query(`UPDATE notificacoes SET status_envio='falhou' WHERE id=$1`, [n.id])
      }
    }
    console.log(`[CRON] ${rows.length} lembretes processados`)
  })
}
