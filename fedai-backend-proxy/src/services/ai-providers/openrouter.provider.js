// fedai-backend-proxy/src/services/ai-providers/openrouter.provider.js
// OpenRouter AI Provider

const BaseAIProvider = require('./base.provider');
const fetch = require('node-fetch');

class OpenRouterProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    this.name = 'openrouter';
    this.apiKey = config.apiKey || process.env.OPENROUTER_API_KEY;
    this.baseUrl = 'https://openrouter.ai/api/v1';
  }

  async validate() {
    if (!this.apiKey) {
      return { valid: false, error: 'API key is required for OpenRouter' };
    }

    try {
      await this.testConnection();
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async generateContent({ systemInstruction, image, model = 'google/gemini-2.0-flash-exp:free', signal }) {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const messages = [
        {
          role: 'system',
          content: systemInstruction
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${image.mimeType};base64,${image.base64}`
              }
            }
          ]
        }
      ];

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://fedai.app',
          'X-Title': 'Fedai Plant Health AI'
        },
        body: JSON.stringify({
          model,
          messages,
          response_format: { type: 'json_object' }
        }),
        signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from OpenRouter');
      }

      return data.choices[0].message.content;
    } catch (error) {
      console.error('OpenRouter API error:', error);
      throw new Error(`OpenRouter API error: ${error.message}`);
    }
  }

  async testConnection() {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemma-4-31b-it:free',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 5
        })
      });

      if (response.ok) {
        return { status: 'UP', details: 'OpenRouter API is accessible' };
      } else {
        const errorText = await response.text();
        return { status: 'DOWN', details: `API error: ${response.status} - ${errorText}` };
      }
    } catch (error) {
      return { status: 'DOWN', details: error.message };
    }
  }

  /**
   * Fetch available models from OpenRouter
   */
  async getAvailableModels() {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();

      // Filter for vision-capable models and format them
      return data.data
        .filter(model => {
          // Check if model supports vision
          const supportsVision =
            model.architecture?.modality === 'multimodal' ||
            model.id.includes('vision') ||
            model.id.includes('llava') ||
            model.id.includes('gemini') ||
            model.id.includes('gemma-4') ||
            model.id.includes('nemotron') ||
            model.id.includes('glm-4') ||
            model.id.includes('claude-3') ||
            model.id.includes('gpt-4-vision') ||
            model.id.includes('gpt-5') ||
            model.id.includes('qwen') && model.id.includes('vl');

          return supportsVision;
        })
        .map(model => ({
          id: model.id,
          name: model.name || model.id,
          description: model.description || '',
          supportsVision: true,
          pricing: model.pricing,
          context_length: model.context_length
        }))
        .sort((a, b) => {
          // Sort free models first
          const aFree = a.id.includes(':free');
          const bFree = b.id.includes(':free');
          if (aFree && !bFree) return -1;
          if (!aFree && bFree) return 1;
          return a.name.localeCompare(b.name);
        });
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error);
      // Return fallback list
      return [
        { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B IT (Free)', supportsVision: true },
        { id: 'google/gemma-4-26b-a4b-it:free', name: 'Gemma 4 26B A4B IT (Free)', supportsVision: true },
        { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', name: 'NVIDIA Nemotron 3 Nano Omni 30B (Free)', supportsVision: true },
        { id: 'nvidia/nemotron-nano-12b-v2-vl:free', name: 'NVIDIA Nemotron Nano 12B v2 VL (Free)', supportsVision: true }
      ];
    }
  }

  getMetadata() {
    return {
      name: 'OpenRouter',
      provider: 'openrouter',
      requiresApiKey: true,
      supportsVision: true,
      supportsStreaming: true,
      defaultModel: 'google/gemma-4-31b-it:free',
      availableModels: [
        'google/gemma-4-31b-it:free',
        'google/gemma-4-26b-a4b-it:free',
        'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
        'nvidia/nemotron-nano-12b-v2-vl:free',
        'anthropic/claude-sonnet-5',
        'openai/gpt-5.6-sol',
        'google/gemini-3-flash'
      ],
      note: 'Some models are free, others require credits. Check OpenRouter pricing.'
    };
  }
}

module.exports = OpenRouterProvider;
