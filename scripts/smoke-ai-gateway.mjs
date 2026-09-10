// Opt-in live test: uses the configured Gateway key and a synthetic image only.
// Run with node --env-file=<AI-only environment file> scripts/smoke-ai-gateway.mjs.
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import ts from 'typescript'
import sharp from 'sharp'

if (!process.env.AI_GATEWAY_API_KEY) throw new Error('AI_GATEWAY_API_KEY is required')
const moduleUrl = new URL(`.gateway-smoke-${randomUUID()}.mjs`, import.meta.url)
try {
  // Execute the real adapter outside Next.js without the server-only marker.
  const source = (await readFile(new URL('../lib/ai-gateway.ts', import.meta.url), 'utf8'))
    .replace("import 'server-only'", '')
  await writeFile(moduleUrl, ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText)
  const { gatewayGenerate } = await import(moduleUrl.href)
  const png = await sharp(Buffer.from('<svg width="600" height="180"><rect width="600" height="180" fill="white"/><text x="20" y="95" font-size="48">TEST 12345</text></svg>')).png().toBuffer()
  const start = Date.now()
  const result = await gatewayGenerate({
    contents: [{ parts: [
      { text: 'Read the text in the image. Return only JSON with one field named text. Do not add any other text.' },
      { inlineData: { mimeType: 'image/png', data: png.toString('base64') } },
    ] }],
    generationConfig: { responseMimeType: 'application/json' },
  }, 'vision')
  if (JSON.parse(result).text?.trim() !== 'TEST 12345') throw new Error('Synthetic image was not read correctly')
  console.log('GATEWAY_VISION_SMOKE_PASS', JSON.stringify({ elapsedMs: Date.now() - start, text: 'TEST 12345' }))
} catch (error) {
  // Never log raw SDK error objects: they can contain request headers/body.
  console.error('GATEWAY_VISION_SMOKE_FAIL', JSON.stringify({ name: error.name, status: error.statusCode }))
  process.exitCode = 1
} finally {
  await unlink(moduleUrl).catch(() => {})
}
