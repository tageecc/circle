/**
 * 模型价格配置
 * - 国内模型（qwen, deepseek）: 单位为人民币（CNY）/百万tokens
 * - 国际模型（claude）: 单位为美元（USD）/百万tokens
 * 
 * 数据来源：
 * - Qwen: https://help.aliyun.com/zh/model-studio/model-pricing
 * - Claude: https://www.anthropic.com/pricing
 */

interface PriceTier {
  maxTokens: number
  inputPrice: number
  outputPrice: number
}

interface ModelPricing {
  tiers?: PriceTier[]
  inputPrice?: number
  outputPrice?: number
  currency: 'CNY' | 'USD' // 货币类型
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // ===== 国内模型（人民币计费）=====
  
  // Qwen Max - 阶梯计费
  'qwen-max': {
    currency: 'CNY',
    tiers: [
      { maxTokens: 32000, inputPrice: 3.2, outputPrice: 12.8 },
      { maxTokens: 128000, inputPrice: 6.4, outputPrice: 25.6 },
      { maxTokens: 252000, inputPrice: 9.6, outputPrice: 38.4 }
    ]
  },
  
  // Qwen Plus - 阶梯计费
  'qwen-plus': {
    currency: 'CNY',
    tiers: [
      { maxTokens: 128000, inputPrice: 0.8, outputPrice: 2 },
      { maxTokens: 256000, inputPrice: 2.4, outputPrice: 20 },
      { maxTokens: 1000000, inputPrice: 4.8, outputPrice: 48 }
    ]
  },
  
  // Qwen Turbo - 固定价格
  'qwen-turbo': {
    currency: 'CNY',
    inputPrice: 0.3,
    outputPrice: 0.6
  },
  
  // QwQ Plus - 固定价格
  'qwq-plus': {
    currency: 'CNY',
    inputPrice: 1.6,
    outputPrice: 4
  },
  
  // DeepSeek V3.2 - 固定价格
  'deepseek-v3.2': {
    currency: 'CNY',
    inputPrice: 2,
    outputPrice: 3
  },
  
  // DeepSeek R1 - 固定价格
  'deepseek-r1': {
    currency: 'CNY',
    inputPrice: 4,
    outputPrice: 16
  },
  
  // DeepSeek Chat - 固定价格
  'deepseek-chat': {
    currency: 'CNY',
    inputPrice: 2,
    outputPrice: 3
  },
  
  // DeepSeek Reasoner - 固定价格
  'deepseek-reasoner': {
    currency: 'CNY',
    inputPrice: 4,
    outputPrice: 16
  },
  
  // ===== 国际模型（美元计费）=====
  
  // Claude 3.5 Sonnet - 固定价格
  'claude-3-5-sonnet-20241022': {
    currency: 'USD',
    inputPrice: 3,
    outputPrice: 15
  },
  
  // Claude 3.5 Sonnet (latest)
  'claude-3-5-sonnet-latest': {
    currency: 'USD',
    inputPrice: 3,
    outputPrice: 15
  }
}

/**
 * 提取真正的 model ID
 * 从 "Alibaba (China)/qwen-max" 提取 "qwen-max"
 */
function extractModelId(modelId: string): string {
  const parts = modelId.split('/')
  return parts.length > 1 ? parts[1] : modelId
}

/**
 * 计算模型使用费用
 */
export function calculateModelCost(
  modelId: string,
  usage: { input: number; output: number }
): { 
  cost: number
  currency: 'CNY' | 'USD'
} | null {
  const actualModelId = extractModelId(modelId)
  const pricing = MODEL_PRICING[actualModelId]
  
  if (!pricing) {
    return null
  }

  let inputPricePerM: number
  let outputPricePerM: number

  if (pricing.tiers) {
    // 阶梯计费：找到对应阶梯，如果超过所有阶梯则使用最后一个
    const tier = pricing.tiers.find(t => usage.input <= t.maxTokens) 
      ?? pricing.tiers[pricing.tiers.length - 1]
    inputPricePerM = tier.inputPrice
    outputPricePerM = tier.outputPrice
  } else {
    // 固定价格
    inputPricePerM = pricing.inputPrice ?? 0
    outputPricePerM = pricing.outputPrice ?? 0
  }

  // 计算费用
  const inputCost = (usage.input / 1000000) * inputPricePerM
  const outputCost = (usage.output / 1000000) * outputPricePerM
  const totalCost = inputCost + outputCost

  return {
    cost: totalCost,
    currency: pricing.currency
  }
}
