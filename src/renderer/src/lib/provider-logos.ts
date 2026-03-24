/**
 * AI 提供商的 Logo 映射表
 * Logo 来源: https://mastra.ai/models/providers
 * 所有 Logo 托管在: https://models.dev/logos/
 */

export interface ProviderLogo {
  provider: string
  logoUrl: string
  alt: string
}

export const PROVIDER_LOGOS: Record<string, string> = {
  OpenAI: 'https://models.dev/logos/openai.svg',
  Anthropic: 'https://models.dev/logos/anthropic.svg',
  Google: 'https://models.dev/logos/google.svg',
  DeepSeek: 'https://models.dev/logos/deepseek.svg',
  Groq: 'https://models.dev/logos/groq.svg',
  Mistral: 'https://models.dev/logos/mistral.svg',
  xAI: 'https://models.dev/logos/xai.svg',
  AIHubMix: 'https://models.dev/logos/aihubmix.svg',
  Alibaba: 'https://models.dev/logos/alibaba.svg',
  'Alibaba (China)': 'https://models.dev/logos/alibaba-cn.svg',
  'Amazon Bedrock': 'https://models.dev/logos/bedrock.svg',
  Azure: 'https://models.dev/logos/azure.svg',
  Baseten: 'https://models.dev/logos/baseten.svg',
  Cerebras: 'https://models.dev/logos/cerebras.svg',
  Chutes: 'https://models.dev/logos/chutes.svg',
  'Cloudflare Workers AI': 'https://models.dev/logos/cloudflare.svg',
  Cortecs: 'https://models.dev/logos/cortecs.svg',
  'Deep Infra': 'https://models.dev/logos/deepinfra.svg',
  FastRouter: 'https://models.dev/logos/fastrouter.svg',
  'Fireworks AI': 'https://models.dev/logos/fireworks-ai.svg',
  'GitHub Models': 'https://models.dev/logos/github-models.svg',
  'Google Vertex AI': 'https://models.dev/logos/google-vertex.svg',
  'Hugging Face': 'https://models.dev/logos/huggingface.svg',
  Inception: 'https://models.dev/logos/inception.svg',
  Inference: 'https://models.dev/logos/inference.svg',
  Llama: 'https://models.dev/logos/llama.svg',
  LMStudio: 'https://models.dev/logos/lmstudio.svg',
  'LucidQuery AI': 'https://models.dev/logos/lucidquery.svg',
  ModelScope: 'https://models.dev/logos/modelscope.svg',
  'Moonshot AI': 'https://models.dev/logos/moonshotai.svg',
  'Moonshot AI (China)': 'https://models.dev/logos/moonshotai-cn.svg',
  Morph: 'https://models.dev/logos/morph.svg',
  'Nebius AI Studio': 'https://models.dev/logos/nebius.svg',
  Nvidia: 'https://models.dev/logos/nvidia.svg',
  Ollama: 'https://models.dev/logos/ollama.svg',
  'OpenCode Zen': 'https://models.dev/logos/opencode.svg',
  OpenRouter: 'https://models.dev/logos/openrouter.svg',
  Perplexity: 'https://models.dev/logos/perplexity.svg',
  Requesty: 'https://models.dev/logos/requesty.svg',
  Scaleway: 'https://models.dev/logos/scaleway.svg',
  submodel: 'https://models.dev/logos/submodel.svg',
  Synthetic: 'https://models.dev/logos/synthetic.svg',
  'Together AI': 'https://models.dev/logos/togetherai.svg',
  Upstage: 'https://models.dev/logos/upstage.svg',
  'Venice AI': 'https://models.dev/logos/venice.svg',
  Vultr: 'https://models.dev/logos/vultr.svg',
  'Weights & Biases': 'https://models.dev/logos/wandb.svg',
  'Z.AI': 'https://models.dev/logos/zai.svg',
  'Z.AI Coding Plan': 'https://models.dev/logos/zai-coding-plan.svg',
  ZenMux: 'https://models.dev/logos/zenmux.svg',
  'Zhipu AI': 'https://models.dev/logos/zhipuai.svg',
  'Zhipu AI Coding Plan': 'https://models.dev/logos/zhipuai-coding-plan.svg'
}

/**
 * 获取提供商的 Logo URL
 * @param provider 提供商名称
 * @returns Logo URL，如果没有找到则返回 undefined
 */
export function getProviderLogo(provider: string): string | undefined {
  return PROVIDER_LOGOS[provider]
}

/**
 * 检查提供商是否有 Logo
 * @param provider 提供商名称
 * @returns 是否有 Logo
 */
export function hasProviderLogo(provider: string): boolean {
  return provider in PROVIDER_LOGOS
}
