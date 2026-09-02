import { ClaudeAIProvider } from './ClaudeAIProvider'
import { MockAIProvider } from './MockAIProvider'
import type { AIProvider } from './types'

export type { AIProvider, MessageClassification } from './types'
export { checkAIHealth } from './ClaudeAIProvider'
export type { AIHealth } from './ClaudeAIProvider'

// Single place to choose the provider.
//
// Default: ClaudeAIProvider — it routes AI work through the stateless server
// (which holds the API key) and degrades gracefully to mock behaviour whenever
// the server or Claude is unavailable, so the app works with OR without a key.
//
// Set VITE_AI_PROVIDER=mock to force the offline mock provider.
let provider: AIProvider | null = null

export function getAIProvider(): AIProvider {
  if (!provider) {
    const mode = import.meta.env.VITE_AI_PROVIDER
    provider = mode === 'mock' ? new MockAIProvider() : new ClaudeAIProvider()
  }
  return provider
}
