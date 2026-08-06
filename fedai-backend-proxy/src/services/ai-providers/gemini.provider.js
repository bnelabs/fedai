// fedai-backend-proxy/src/services/ai-providers/gemini.provider.js
// Google Gemini AI Provider

const BaseAIProvider = require('./base.provider');
const { GoogleGenAI } = require('@google/genai');

// SOTA-first preference order. The provider queries the real ListModels API
// and picks the first of these the key can actually access.
const MODEL_PREFERENCE = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash'
];

const MODEL_FALLBACK = 'gemini-2.5-flash';

class GeminiProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    this.name = 'gemini';
    this.apiKey = config.apiKey || process.env.GEMINI_API_KEY;
    this.client = this.apiKey ? new GoogleGenAI({ apiKey: this.apiKey }) : null;
    this._resolvedModel = null;
    this._modelsCache = null;
  }

  async validate() {
    if (!this.apiKey) {
      return { valid: false, error: 'API key is required for Gemini' };
    }

    try {
      await this.testConnection();
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Resolve the best model this API key can actually use.
   * Queries the real ListModels endpoint; prefers SOTA models in MODEL_PREFERENCE
   * order, falls back to MODEL_FALLBACK if the list is unavailable.
   * @param {boolean} force - bypass the cached resolution
   * @returns {Promise<string>}
   */
  async resolveBestModel(force = false) {
    if (this._resolvedModel && !force) return this._resolvedModel;
    if (!this.client) throw new Error('Gemini client not initialized. API key missing.');

    try {
      const pager = await this.client.models.list({ config: { pageSize: 100 } });
      const models = Array.isArray(pager) ? pager : pager?.models || [];
      const available = new Set(
        models
          .filter((m) => m && typeof m.name === 'string' && m.name.startsWith('models/gemini-'))
          .map((m) => m.name.replace(/^models\//, ''))
      );
      if (available.size === 0) {
        this._resolvedModel = MODEL_FALLBACK;
        return this._resolvedModel;
      }
      const preferred = MODEL_PREFERENCE.find((m) => available.has(m)) || MODEL_FALLBACK;
      this._resolvedModel = preferred;
      return preferred;
    } catch (error) {
      console.warn(`[Gemini] ListModels failed (${error.message}); using fallback model ${MODEL_FALLBACK}`);
      this._resolvedModel = MODEL_FALLBACK;
      return this._resolvedModel;
    }
  }

  /**
   * List models available to this key, SOTA-first.
   * @returns {Promise<Array<{id: string, name: string, description: string, supportsVision: boolean}>>}
   */
  async getAvailableModels(force = false) {
    if (!this.client) {
      throw new Error('Gemini client not initialized');
    }

    if (this._modelsCache && !force) return this._modelsCache;

    try {
      const pager = await this.client.models.list({ config: { pageSize: 100 } });
      const models = Array.isArray(pager) ? pager : pager?.models || [];
      const geminiModels = models
        .filter((m) => m && typeof m.name === 'string' && m.name.startsWith('models/gemini-'))
        .map((m) => {
          const id = m.name.replace(/^models\//, '');
          return {
            id,
            name: m.displayName || id,
            description: m.description || '',
            supportsVision: true
          };
        })
        .sort((a, b) => {
          const ai = MODEL_PREFERENCE.indexOf(a.id);
          const bi = MODEL_PREFERENCE.indexOf(b.id);
          if (ai !== -1 && bi !== -1) return ai - bi;
          if (ai !== -1) return -1;
          if (bi !== -1) return 1;
          return a.id.localeCompare(b.id);
        });

      this._modelsCache = geminiModels.length > 0 ? geminiModels : this._curatedModels();
      return this._modelsCache;
    } catch (error) {
      console.error('Error fetching Gemini models:', error);
      return this._curatedModels();
    }
  }

  _curatedModels() {
    return [
      {
        id: 'gemini-3.6-flash',
        name: 'Gemini 3.6 Flash',
        description: 'Latest fast model with multimodal vision support',
        supportsVision: true
      },
      {
        id: 'gemini-3.5-flash',
        name: 'Gemini 3.5 Flash',
        description: 'Fast multimodal model with vision support',
        supportsVision: true
      },
      {
        id: 'gemini-3-flash',
        name: 'Gemini 3 Flash',
        description: 'Multimodal vision model',
        supportsVision: true
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Widely available multimodal model',
        supportsVision: true
      }
    ];
  }

  async generateContent({ systemInstruction, image, model, signal }) {
    if (!this.client) {
      throw new Error('Gemini client not initialized. API key missing.');
    }

    try {
      const modelToUse = model || (await this.resolveBestModel());

      const imagePart = {
        inlineData: {
          mimeType: image.mimeType,
          data: image.base64
        }
      };

      const contents = { parts: [imagePart] };

      const response = await this.client.models.generateContent({
        model: modelToUse,
        contents,
        config: {
          responseMimeType: 'application/json',
          systemInstruction
        }
      });

      let jsonResponseString = response.text.trim();

      // Remove markdown code fences if present
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonResponseString.match(fenceRegex);
      if (match && match[2]) {
        jsonResponseString = match[2].trim();
      }

      return jsonResponseString;
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  /**
   * Text-only generation for LLM fallbacks (e.g. weather/soil when external
   * data services are unreachable). Returns a JSON string.
   */
  async generateText({ systemInstruction, prompt, model }) {
    if (!this.client) {
      throw new Error('Gemini client not initialized. API key missing.');
    }

    try {
      const modelToUse = model || (await this.resolveBestModel());
      const response = await this.client.models.generateContent({
        model: modelToUse,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          systemInstruction
        }
      });

      let text = response.text.trim();
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = text.match(fenceRegex);
      if (match && match[2]) {
        text = match[2].trim();
      }
      return text;
    } catch (error) {
      console.error('Gemini generateText error:', error);
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  async testConnection() {
    if (!this.client) {
      throw new Error('Gemini client not initialized');
    }

    try {
      const modelToUse = await this.resolveBestModel();
      await this.client.models.generateContent({
        model: modelToUse,
        contents: 'Test',
        config: {
          responseMimeType: 'text/plain',
          thinkingConfig: { thinkingBudget: 0 }
        }
      });

      return { status: 'UP', details: `Gemini API is accessible (model: ${modelToUse})` };
    } catch (error) {
      return { status: 'DOWN', details: error.message };
    }
  }

  async getMetadata() {
    const defaultModel = await this.resolveBestModel().catch(() => MODEL_FALLBACK);
    const available = await this.getAvailableModels().catch(() => this._curatedModels());
    return {
      name: 'Google Gemini',
      provider: 'gemini',
      requiresApiKey: true,
      supportsVision: true,
      supportsStreaming: false,
      defaultModel,
      availableModels: available.map((m) => m.id)
    };
  }
}

module.exports = GeminiProvider;
