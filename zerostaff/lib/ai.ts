import Groq from 'groq-sdk'

function getGroq() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY })
}

export async function generateText(prompt: string, systemPrompt?: string): Promise<string> {
  const providers = [
    () => callGroq(prompt, systemPrompt),
    () => callGemini(prompt, systemPrompt),
    () => callAnthropic(prompt, systemPrompt),
  ]

  for (const provider of providers) {
    try {
      const result = await provider()
      if (result) return result
    } catch {
      // try next
    }
  }
  throw new Error('All AI providers failed')
}

async function callGroq(prompt: string, systemPrompt?: string): Promise<string> {
  const messages: Groq.Chat.ChatCompletionMessageParam[] = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })

  const res = await getGroq().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    temperature: 0.7,
    max_tokens: 4096,
  })
  return res.choices[0]?.message?.content ?? ''
}

async function callGemini(prompt: string, systemPrompt?: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('No Gemini key')

  const body = {
    contents: [{ role: 'user', parts: [{ text: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt }] }],
    generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

async function callAnthropic(prompt: string, systemPrompt?: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('No Anthropic key')

  const body: Record<string, unknown> = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  }
  if (systemPrompt) body.system = systemPrompt

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}
