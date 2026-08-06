// types/aiSettings.ts
// Type definitions for AI provider settings

export type AIProviderType = 'gemini' | 'openrouter' | 'local-openai';

export interface AIProviderMetadata {
  id: string;
  name: string;
  provider: AIProviderType;
  requiresApiKey: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  defaultModel: string | null;
  availableModels?: string[];
  note?: string;
  examples?: Record<string, string>;
  baseUrl?: string;
}

export interface AISettings {
  provider: AIProviderType;
  apiKey: string;
  baseUrl?: string; // For local OpenAI-compatible APIs
  model?: string; // Optional custom model
  note?: string; // UI hint shown with the preset/settings (e.g. capability flags)
}

export interface AISettingsFormData extends AISettings {
  testStatus?: 'idle' | 'testing' | 'success' | 'error';
  testMessage?: string;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'gemini',
  apiKey: '',
  baseUrl: 'http://localhost:1234/v1',
  model: ''
};

export const AI_PROVIDER_PRESETS: Record<string, Partial<AISettings>> = {
  'lm-studio': {
    provider: 'local-openai',
    baseUrl: 'http://localhost:1234/v1',
    model: 'local-model'
  },
  'llama-cpp': {
    provider: 'local-openai',
    baseUrl: 'http://localhost:8080/v1',
    model: 'llama-model'
  },
  'koboldcpp': {
    provider: 'local-openai',
    baseUrl: 'http://localhost:5001/v1',
    model: 'kobold-model'
  },
  'text-gen-webui': {
    provider: 'local-openai',
    baseUrl: 'http://localhost:5000/v1',
    model: 'text-gen-model'
  },
  // SOTA cloud providers (bring your own API key)
  'openai': {
    provider: 'local-openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.6-sol'
  },
  'anthropic': {
    provider: 'local-openai',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-5'
  },
  'kimi': {
    provider: 'local-openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'kimi-k3'
  },
  'zai': {
    provider: 'local-openai',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    model: 'glm-4.6v-flash'
  },
  'deepseek': {
    provider: 'local-openai',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
    note: 'TEXT-ONLY — no image/vision support. Can analyze text, but not plant photos.'
  },
  'openrouter-free': {
    provider: 'openrouter',
    model: 'google/gemma-4-31b-it:free'
  }
};
