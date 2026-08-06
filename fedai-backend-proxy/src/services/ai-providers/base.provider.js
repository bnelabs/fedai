// fedai-backend-proxy/src/services/ai-providers/base.provider.js
// Base class for AI providers

/**
 * Base AI Provider interface
 * All AI providers must implement these methods
 */
class BaseAIProvider {
  constructor(config) {
    this.config = config;
    this.name = 'base';
  }

  /**
   * Validate provider configuration
   * @returns {Promise<{valid: boolean, error?: string}>}
   */
  async validate() {
    throw new Error('validate() must be implemented by provider');
  }

  /**
   * Generate content from text and image
   * @param {Object} params
   * @param {string} params.systemInstruction - System prompt
   * @param {Object} params.image - Image data {base64, mimeType}
   * @param {string} params.model - Model name
   * @param {AbortSignal} params.signal - Abort signal
   * @returns {Promise<string>} - JSON response as string
   */
  async generateContent(params) {
    throw new Error('generateContent() must be implemented by provider');
  }

  /**
   * Test the provider connection
   * @returns {Promise<{status: 'UP' | 'DOWN', details?: string}>}
   */
  async testConnection() {
    throw new Error('testConnection() must be implemented by provider');
  }

  /**
   * Check whether this provider can analyze images (vision capable).
   * Text-only providers (supportsVision: false) are still selectable, but
   * image analysis is rejected by the controller with PROVIDER_NO_VISION.
   * @returns {boolean}
   */
  supportsVision() {
    return this.getMetadata().supportsVision !== false;
  }

  /**
   * Get provider metadata
   * @returns {Object}
   */
  getMetadata() {
    return {
      name: this.name,
      requiresApiKey: true,
      supportsVision: true,
      supportsStreaming: false,
      defaultModel: null
    };
  }
}

module.exports = BaseAIProvider;
