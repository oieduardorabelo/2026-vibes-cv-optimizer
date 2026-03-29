import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'

export const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION || 'ap-southeast-2',
})

// Use AWS inference profile ID (cross-region inference)
// Override with BEDROCK_MODEL_ID env var if needed
export const model = bedrock(
  process.env.BEDROCK_MODEL_ID || 'apac.anthropic.claude-sonnet-4-20250514-v1:0'
)
