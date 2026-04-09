import alibabaLogo from '@/assets/provider-logos/alibaba.png'
import anthropicLogo from '@/assets/provider-logos/anthropic.png'
import bailianLogo from '@/assets/provider-logos/bailian.png'
import cerebrasLogo from '@/assets/provider-logos/cerebras.png'
import deepseekLogo from '@/assets/provider-logos/deepseek.png'
import fireworksLogo from '@/assets/provider-logos/fireworks.png'
import googleLogo from '@/assets/provider-logos/google.png'
import groqLogo from '@/assets/provider-logos/groq.png'
import lmstudioLogo from '@/assets/provider-logos/lmstudio.png'
import mistralLogo from '@/assets/provider-logos/mistral.png'
import moonshotLogo from '@/assets/provider-logos/moonshot.png'
import ollamaLogo from '@/assets/provider-logos/ollama.png'
import openaiLogo from '@/assets/provider-logos/openai.png'
import openrouterLogo from '@/assets/provider-logos/openrouter.png'
import perplexityLogo from '@/assets/provider-logos/perplexity.png'
import togetherLogo from '@/assets/provider-logos/together.png'
import voyageLogo from '@/assets/provider-logos/voyage.png'
import xaiLogo from '@/assets/provider-logos/xai.png'
import zhipuLogo from '@/assets/provider-logos/zhipu.png'

export interface ProviderLogoAsset {
  src: string
  invertInDark?: boolean
}

export const PROVIDER_LOGOS: Record<string, ProviderLogoAsset> = {
  openai: { src: openaiLogo, invertInDark: true },
  anthropic: { src: anthropicLogo, invertInDark: true },
  google: { src: googleLogo },
  deepseek: { src: deepseekLogo },
  openrouter: { src: openrouterLogo, invertInDark: true },
  xai: { src: xaiLogo, invertInDark: true },
  mistral: { src: mistralLogo },
  groq: { src: groqLogo, invertInDark: true },
  together: { src: togetherLogo },
  cerebras: { src: cerebrasLogo },
  alibaba: { src: alibabaLogo },
  'alibaba-cn': { src: bailianLogo },
  moonshot: { src: moonshotLogo, invertInDark: true },
  zhipu: { src: zhipuLogo },
  perplexity: { src: perplexityLogo },
  fireworks: { src: fireworksLogo },
  ollama: { src: ollamaLogo, invertInDark: true },
  lmstudio: { src: lmstudioLogo, invertInDark: true },
  voyage: { src: voyageLogo }
}

export function getProviderLogo(provider: string): string | undefined {
  return PROVIDER_LOGOS[provider]?.src
}

export function getProviderLogoAsset(provider: string): ProviderLogoAsset | undefined {
  return PROVIDER_LOGOS[provider]
}

export function hasProviderLogo(provider: string): boolean {
  return Boolean(PROVIDER_LOGOS[provider])
}
