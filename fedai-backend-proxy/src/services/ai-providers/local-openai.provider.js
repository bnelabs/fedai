// fedai-backend-proxy/src/services/ai-providers/local-openai.provider.js
// Local OpenAI-compatible API Provider (LM Studio, llama.cpp, KoboldCpp, etc.)

const BaseAIProvider = require('./base.provider');
const fetch = require('node-fetch');

class LocalOpenAIProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    this.name = 'local-openai';
    this.baseUrl = config.baseUrl || config.apiUrl || process.env.LOCAL_AI_URL || 'http://localhost:1234/v1';
    this.apiKey = config.apiKey || 'not-needed';
    this.model = config.model || 'local-model';
  }

  async validate() {
    try {
      await this.testConnection();
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async generateContent({ systemInstruction, image, model, signal }) {
    const modelToUse = model || this.model;

    try {
      // Note: Vision support requires multimodal models like:
      // - LLaVA, MiniCPM-V, Qwen-VL, InternVL, CogVLM, etc.
      // Text-only models (Gemma, Llama 3.1, Mistral, etc.) won't work with images

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

      const requestBody = {
        model: modelToUse,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 4096
      };

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Local AI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from local AI');
      }

      return data.choices[0].message.content;
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Cannot connect to local AI at ${this.baseUrl}. Make sure your local AI server is running.`);
      }
      console.error('Local AI API error:', error);
      throw new Error(`Local AI API error: ${error.message}`);
    }
  }

  /**
   * Text-only generation for LLM fallbacks (weather/soil). Returns JSON string.
   */
  async generateText({ systemInstruction, prompt, model }) {
    const modelToUse = model || this.model;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': this.apiKey ? `Bearer ${this.apiKey}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
          max_tokens: 2048
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Local AI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from local AI');
      }
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Local AI generateText error:', error);
      throw new Error(`Local AI API error: ${error.message}`);
    }
  }

  async testConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return {
          status: 'UP',
          details: `Connected to local AI at ${this.baseUrl}`,
          models: data.data ? data.data.map(m => m.id) : []
        };
      } else {
        return {
          status: 'DOWN',
          details: `API returned status ${response.status}`
        };
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        return {
          status: 'DOWN',
          details: `Cannot connect to ${this.baseUrl}. Make sure your local AI server is running.`
        };
      }
      return {
        status: 'DOWN',
        details: error.message
      };
    }
  }

  /**
   * Fetch available models from local server
   */
  async getAvailableModels() {
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

      if (data.data && Array.isArray(data.data)) {
        return data.data.map(model => ({
          id: model.id,
          name: model.id,
          description: model.owned_by || 'Local model',
          supportsVision: true // Assume vision support for local models
        }));
      }

      return [];
    } catch (error) {
      console.error('Error fetching local models:', error);
      // Return empty array - user can manually enter model name
      return [];
    }
  }

  getMetadata() {
    return {
      name: 'Local OpenAI-Compatible',
      provider: 'local-openai',
      requiresApiKey: false,
      supportsVision: true,
      supportsStreaming: true,
      defaultModel: this.model,
      baseUrl: this.baseUrl,
      note: 'Works with LM Studio, llama.cpp, KoboldCpp, and other OpenAI-compatible APIs',
      examples: {
        lmStudio: 'http://localhost:1234/v1',
        llamaCpp: 'http://localhost:8080/v1',
        koboldCpp: 'http://localhost:5001/v1',
        textGenWebUI: 'http://localhost:5000/v1'
      }
    };
  }
}

module.exports = LocalOpenAIProvider;
