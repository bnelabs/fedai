import React, { useState, useEffect } from 'react';
import { useAISettings } from '@/contexts/AISettingsContext';
import { AIProviderType, AIProviderMetadata, AI_PROVIDER_PRESETS } from '@/types/aiSettings';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useLocalizationContext } from '@/components/LocalizationContext';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  supportsVision?: boolean;
  pricing?: any;
  context_length?: number;
}

const AISettingsModal: React.FC<AISettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings } = useAISettings();
  const { uiStrings } = useLocalizationContext();

  const [providers, setProviders] = useState<AIProviderMetadata[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const [formData, setFormData] = useState(settings);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Load available providers
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const response = await fetch('/api/gemini-proxy/providers');
        if (response.ok) {
          const data = await response.json();
          setProviders(data.providers || []);
        }
      } catch (error) {
        console.error('Failed to load AI providers:', error);
      } finally {
        setIsLoadingProviders(false);
      }
    };

    if (isOpen) {
      loadProviders();
      setFormData(settings);
    }
  }, [isOpen, settings]);

  // Fetch available models when provider or API key changes
  useEffect(() => {
    const fetchModels = async () => {
      // Only fetch if we have required configuration
      const needsApiKey = formData.provider === 'gemini' || formData.provider === 'openrouter';
      const hasApiKey = formData.apiKey && formData.apiKey.length > 0;
      const needsBaseUrl = formData.provider === 'local-openai';
      const hasBaseUrl = formData.baseUrl && formData.baseUrl.length > 0;

      if (needsApiKey && !hasApiKey) {
        setModels([]);
        return;
      }

      if (needsBaseUrl && !hasBaseUrl) {
        setModels([]);
        return;
      }

      setIsLoadingModels(true);
      setModelsError('');

      try {
        const queryParams = new URLSearchParams({
          aiProvider: formData.provider,
          ...(formData.baseUrl && { aiBaseUrl: formData.baseUrl })
        });

        // Send the API key via the Authorization header — never in the query string
        const headers: Record<string, string> = {};
        if (formData.apiKey) {
          headers['Authorization'] = `Bearer ${formData.apiKey}`;
        }

        const response = await fetch(`/api/gemini-proxy/models?${queryParams}`, { headers });
        const data = await response.json();

        if (response.ok && data.models) {
          setModels(data.models);
          setModelsError('');
        } else {
          setModelsError(data.error || 'Failed to fetch models');
          setModels([]);
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
        setModelsError(error instanceof Error ? error.message : 'Failed to fetch models');
        setModels([]);
      } finally {
        setIsLoadingModels(false);
      }
    };

    if (isOpen && formData.provider) {
      fetchModels();
    }
  }, [isOpen, formData.provider, formData.apiKey, formData.baseUrl]);

  const handleProviderChange = (provider: AIProviderType) => {
    setFormData(prev => ({
      ...prev,
      provider,
      // Reset fields when changing provider
      apiKey: '',
      baseUrl: provider === 'local-openai' ? 'http://localhost:1234/v1' : undefined,
      model: '',
      note: undefined
    }));
    setTestStatus('idle');
    setTestMessage('');
  };

  const handlePresetSelect = (presetKey: string) => {
    const preset = AI_PROVIDER_PRESETS[presetKey];
    if (preset) {
      setFormData(prev => ({ ...prev, ...preset, note: preset.note || undefined }));
    }
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');

    try {
      const queryParams = new URLSearchParams({
        aiProvider: formData.provider,
        ...(formData.baseUrl && { aiBaseUrl: formData.baseUrl }),
        ...(formData.model && { aiModel: formData.model })
      });

      // Send the API key via the Authorization header — never in the query string
      const headers: Record<string, string> = {};
      if (formData.apiKey) {
        headers['Authorization'] = `Bearer ${formData.apiKey}`;
      }

      const response = await fetch(`/api/gemini-proxy/status?${queryParams}`, { headers });
      const data = await response.json();

      if (response.ok && data.status === 'UP') {
        setTestStatus('success');
        setTestMessage(data.details || 'Connection successful!');
      } else {
        setTestStatus('error');
        setTestMessage(data.details || 'Connection failed');
      }
    } catch (error) {
      setTestStatus('error');
      setTestMessage(error instanceof Error ? error.message : 'Connection failed');
    }
  };

  const handleSave = () => {
    updateSettings(formData);
    onClose();
  };

  const selectedProvider = providers.find(p => p.provider === formData.provider);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Provider Settings"
      size="lg"
      primaryAction={{
        label: 'Save',
        onClick: handleSave,
        className: 'btn-primary',
        ariaLabel: 'Save AI settings'
      }}
      secondaryAction={{
        label: 'Cancel',
        onClick: onClose,
        className: 'btn-secondary',
        ariaLabel: 'Cancel'
      }}
    >
      <div className="space-y-6">
        {/* Provider Selection */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            AI Provider
          </label>
          {isLoadingProviders ? (
            <div className="flex items-center space-x-2">
              <LoadingSpinner className="w-4 h-4" />
              <span className="text-sm text-[var(--text-secondary)]">Loading providers...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {providers.map(provider => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => handleProviderChange(provider.provider)}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    formData.provider === provider.provider
                      ? 'border-[var(--primary-500)] bg-[var(--primary-50)]'
                      : 'border-[var(--border-color-soft)] hover:border-[var(--primary-300)]'
                  }`}
                >
                  <div className="font-medium text-[var(--text-primary)]">{provider.name}</div>
                  {provider.note && (
                    <div className="text-xs text-[var(--text-secondary)] mt-1">{provider.note}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* API Key Field (for Gemini and OpenRouter) */}
        {selectedProvider?.requiresApiKey && (
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              API Key
              <span className="text-[var(--status-red)] ml-1">*</span>
            </label>
            <input
              type="password"
              value={formData.apiKey}
              onChange={e => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
              className="w-full px-3 py-2 border border-[var(--border-color-soft)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
              placeholder="Enter your API key"
            />
            {formData.provider === 'gemini' && (
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Get your API key from{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--primary-500)] hover:underline"
                >
                  Google AI Studio
                </a>
              </p>
            )}
            {formData.provider === 'openrouter' && (
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Get your API key from{' '}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--primary-500)] hover:underline"
                >
                  OpenRouter
                </a>
              </p>
            )}
          </div>
        )}

        {/* Base URL Field (for local OpenAI-compatible) */}
        {formData.provider === 'local-openai' && (
          <>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Quick Presets
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(AI_PROVIDER_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handlePresetSelect(key)}
                    className="px-3 py-2 text-sm border border-[var(--border-color-soft)] rounded-lg hover:bg-[var(--primary-50)] transition-colors"
                  >
                    {key}
                  </button>
                ))}
              </div>
              {formData.note && (
                <p className="text-xs text-[var(--status-yellow-text)] mt-2">
                  ⚠️ {formData.note}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                API Base URL
                <span className="text-[var(--status-red)] ml-1">*</span>
              </label>
              <input
                type="text"
                value={formData.baseUrl || ''}
                onChange={e => setFormData(prev => ({ ...prev, baseUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-[var(--border-color-soft)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
                placeholder="http://localhost:1234/v1"
              />
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Works with LM Studio, llama.cpp, KoboldCpp, Text Generation WebUI
              </p>
            </div>

            <div className="p-3 bg-[var(--status-yellow-bg)] border border-[var(--status-yellow)] rounded-lg">
              <p className="text-xs font-medium text-[var(--status-yellow-text)] mb-1">
                ⚠️ Vision Model Required
              </p>
              <p className="text-xs text-[var(--status-yellow-text)]">
                This app analyzes plant images. Use vision-capable models like: <strong>LLaVA</strong>, <strong>MiniCPM-V</strong>, <strong>Qwen-VL</strong>, <strong>InternVL</strong>, or <strong>CogVLM</strong>.
                <br />
                Text-only models (Gemma, Llama 3.1, Mistral) won't work.
              </p>
            </div>
          </>
        )}

        {/* Model Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-[var(--text-primary)]">
              Model (optional)
            </label>
            {models.length > 0 && (
              <button
                type="button"
                onClick={() => setShowManualInput(!showManualInput)}
                className="text-xs text-[var(--primary-500)] hover:underline"
              >
                {showManualInput ? 'Show list' : 'Enter manually'}
              </button>
            )}
          </div>

          {isLoadingModels ? (
            <div className="flex items-center space-x-2 p-3 border border-[var(--border-color-soft)] rounded-lg">
              <LoadingSpinner className="w-4 h-4" />
              <span className="text-sm text-[var(--text-secondary)]">Loading models...</span>
            </div>
          ) : modelsError ? (
            <div className="p-3 bg-[var(--status-yellow-bg)] text-[var(--status-yellow-text)] rounded-lg text-sm">
              <p className="mb-2">⚠️ {modelsError}</p>
              <input
                type="text"
                value={formData.model || ''}
                onChange={e => setFormData(prev => ({ ...prev, model: e.target.value }))}
                className="w-full px-3 py-2 border border-[var(--border-color-soft)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)] bg-white"
                placeholder="Enter model name manually"
              />
            </div>
          ) : models.length > 0 && !showManualInput ? (
            <div className="space-y-2">
              <select
                value={formData.model || ''}
                onChange={e => setFormData(prev => ({ ...prev, model: e.target.value }))}
                className="w-full px-3 py-2 border border-[var(--border-color-soft)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
              >
                <option value="">Use default model</option>
                {models.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name || model.id}
                    {model.id.includes(':free') ? ' (Free)' : ''}
                  </option>
                ))}
              </select>
              {formData.model && models.find(m => m.id === formData.model) && (
                <div className="p-2 bg-[var(--glass-bg-secondary)] rounded text-xs text-[var(--text-secondary)]">
                  {models.find(m => m.id === formData.model)?.description}
                </div>
              )}
            </div>
          ) : (
            <input
              type="text"
              value={formData.model || ''}
              onChange={e => setFormData(prev => ({ ...prev, model: e.target.value }))}
              className="w-full px-3 py-2 border border-[var(--border-color-soft)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-500)]"
              placeholder={selectedProvider?.defaultModel || 'Default model will be used'}
            />
          )}

          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {formData.model
              ? `Using: ${formData.model}`
              : `Default: ${selectedProvider?.defaultModel || 'Provider default'}`}
          </p>
        </div>

        {/* Test Connection */}
        <div>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testStatus === 'testing'}
            className="w-full px-4 py-2 bg-[var(--primary-500)] text-white rounded-lg hover:bg-[var(--primary-600)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {testStatus === 'testing' ? (
              <span className="flex items-center justify-center space-x-2">
                <LoadingSpinner className="w-4 h-4" />
                <span>Testing connection...</span>
              </span>
            ) : (
              'Test Connection'
            )}
          </button>

          {testStatus !== 'idle' && testStatus !== 'testing' && (
            <div
              className={`mt-3 p-3 rounded-lg ${
                testStatus === 'success'
                  ? 'bg-[var(--status-green-bg)] text-[var(--status-green-text)]'
                  : 'bg-[var(--status-red-bg)] text-[var(--status-red-text)]'
              }`}
            >
              <div className="flex items-start space-x-2">
                <span className="text-lg">
                  {testStatus === 'success' ? '✓' : '✗'}
                </span>
                <span className="text-sm">{testMessage}</span>
              </div>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="p-4 bg-[var(--glass-bg-secondary)] rounded-lg border border-[var(--glass-border)]">
          <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">
            ℹ️ About AI Providers
          </h4>
          <ul className="text-xs text-[var(--text-secondary)] space-y-1">
            <li>• <strong>Google Gemini:</strong> Requires API key. Fast and accurate.</li>
            <li>• <strong>OpenRouter:</strong> Access to multiple models. Some are free.</li>
            <li>• <strong>Local AI:</strong> Run models locally with LM Studio, llama.cpp, etc.</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};

export default AISettingsModal;
