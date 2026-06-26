import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function analisarComIA(textoEdital) {
  const prompt = `Você é especialista em licitações públicas brasileiras (Lei 14.133/2021 e 8.666/93).
Analise o edital abaixo e retorne APENAS um JSON válido, sem markdown, sem explicações extras.

Estrutura obrigatória:
{
  "objeto": "descrição resumida do objeto contratado",
  "orgao": "nome completo do órgão licitante",
  "modalidade": "pregao_eletronico | pregao_presencial | concorrencia | tomada_precos | convite",
  "valor_estimado": 0.00,
  "documentos_exigidos": [
    {
      "nome": "nome exato do documento",
      "tipo": "fiscal | juridico | tecnico | economico | trabalhista",
      "obrigatorio": true,
      "observacao": "detalhes específicos se houver"
    }
  ],
  "prazos": [
    {
      "tipo": "entrega_proposta | sessao_publica | recurso | contrato | habilitacao",
      "data_hora": "2025-06-27T14:00:00",
      "descricao": "descrição do prazo"
    }
  ],
  "confianca": 0.95
}

EDITAL:
${textoEdital.slice(0, 80000)}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  })

  const raw = response.content[0].text
  const resultado = JSON.parse(raw.replace(/```json|```/g, '').trim())

  return {
    resultado,
    tokens_usados: response.usage.input_tokens + response.usage.output_tokens
  }
}
