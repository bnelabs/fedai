import {
  type ImageFile,
  type Language,
  type UserLocation,
  type WeatherData,
  type EnvironmentalData,
  type DiseaseInfo,
  type TestServiceResult
} from '../types';
import { AISettings } from '@/types/aiSettings';
import { GEMINI_ANALYSIS_TIMEOUT_MS, GEMINI_TEST_TIMEOUT_MS, API_BASE_URL } from '@/constants';
import { handleApiError, logError } from '@/utils/errorHandler';

/**
 * Enhanced analyzePlantHealth with multi-provider support
 */
export async function analyzePlantHealth(
  imageFile: ImageFile,
  userDescription: string | null,
  language: Language,
  userLocation: UserLocation | null,
  weatherData: WeatherData | null,
  environmentalData: EnvironmentalData | null,
  _deviceTilt: null,
  _uiStringsApiKeyError: string,
  _uiStringsAnalysisError: string,
  followUpAnswer?: string | null,
  aiSettings?: AISettings // Optional AI settings override
): Promise<DiseaseInfo> {
  const requestPayload: any = {
    image: {
      base64: imageFile.base64,
      mimeType: imageFile.mimeType
    },
    userDescription,
    language,
    userLocation,
    weatherData,
    environmentalData,
    followUpAnswer
  };

  // Add AI provider settings if provided
  if (aiSettings) {
    console.log('[DEBUG] AI Settings provided:', {
      provider: aiSettings.provider,
      hasApiKey: !!aiSettings.apiKey,
      apiKeyLength: aiSettings.apiKey?.length || 0,
      model: aiSettings.model
    });
    requestPayload.aiProvider = aiSettings.provider;
    requestPayload.aiApiKey = aiSettings.apiKey;
    if (aiSettings.baseUrl) {
      requestPayload.aiBaseUrl = aiSettings.baseUrl;
    }
    if (aiSettings.model) {
      requestPayload.aiModel = aiSettings.model;
    }
  } else {
    console.warn('[DEBUG] No AI settings provided to analysis!');
  }

  const PROXY_ENDPOINT = `${API_BASE_URL}/api/gemini-proxy`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, GEMINI_ANALYSIS_TIMEOUT_MS);

    const response = await fetch(PROXY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let proxyErrorMsg = `Proxy error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          proxyErrorMsg = errorData.error;
        }
      } catch (e) {
        // Ignore if error response is not JSON
      }

      if (response.status === 429) proxyErrorMsg = `Rate limit exceeded: ${proxyErrorMsg}`;
      else if (response.status === 503) proxyErrorMsg = `Service unavailable: ${proxyErrorMsg}`;

      throw new Error(proxyErrorMsg);
    }

    const parsedResponse = (await response.json()) as DiseaseInfo;

    const completeResponse: DiseaseInfo = {
      diseaseName: parsedResponse.diseaseName || null,
      definition: parsedResponse.definition || null,
      possibleCauses: parsedResponse.possibleCauses || [],
      structuredSolutions: parsedResponse.structuredSolutions || [],
      aiWeatherRelevance: parsedResponse.aiWeatherRelevance || null,
      similarPastCases: parsedResponse.similarPastCases || null,
      error: parsedResponse.error || null,
      errorKey: parsedResponse.errorKey || null,
      followUpQuestion: parsedResponse.followUpQuestion || null,
      imageQualityNotes: parsedResponse.imageQualityNotes || null,
      differentialDiagnoses: parsedResponse.differentialDiagnoses || null,
      qualitativeConfidence: parsedResponse.qualitativeConfidence || null,
      errorCode: parsedResponse.errorCode || null,
      locationConsidered: parsedResponse.locationConsidered || false,
      weatherConsidered: parsedResponse.weatherConsidered || false,
      environmentalDataConsidered: parsedResponse.environmentalDataConsidered || false
    };

    if (completeResponse.error || completeResponse.errorKey || completeResponse.errorCode) {
      throw new Error(
        completeResponse.error ||
          `Analysis indicated an issue: ${completeResponse.errorKey || completeResponse.errorCode}`
      );
    }

    return completeResponse;
  } catch (error) {
    const fedaiError = handleApiError(error, 'Analysis failed');
    logError(fedaiError, 'PlantHealthAnalysis');
    throw new Error(fedaiError.message);
  }
}

/**
 * Enhanced testGeminiService with multi-provider support
 */
export async function testAIService(aiSettings?: AISettings): Promise<TestServiceResult> {
  const queryParams = new URLSearchParams();

  if (aiSettings) {
    queryParams.set('aiProvider', aiSettings.provider);
    if (aiSettings.baseUrl) {
      queryParams.set('aiBaseUrl', aiSettings.baseUrl);
    }
    if (aiSettings.model) {
      queryParams.set('aiModel', aiSettings.model);
    }
  }

  const PROXY_STATUS_ENDPOINT = `${API_BASE_URL}/api/gemini-proxy/status${
    queryParams.toString() ? '?' + queryParams.toString() : ''
  }`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TEST_TIMEOUT_MS);

    // Send the API key via the Authorization header — never in the query string
    const headers: Record<string, string> = {};
    if (aiSettings?.apiKey) {
      headers['Authorization'] = `Bearer ${aiSettings.apiKey}`;
    }

    const response = await fetch(PROXY_STATUS_ENDPOINT, {
      signal: controller.signal,
      headers
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.status === 'UP') {
        return {
          status: 'UP',
          details: data.details,
          provider: data.provider
        };
      }
      return {
        status: 'DOWN',
        details: data.details || 'Proxy status endpoint returned non-UP status'
      };
    }
    return { status: 'DOWN', details: `Proxy status endpoint HTTP error: ${response.status}` };
  } catch (error) {
    const fedaiError = handleApiError(
      error,
      'Failed to connect to backend proxy status endpoint'
    );
    logError(fedaiError, 'AIServiceTest');
    return { status: 'DOWN', details: fedaiError.message };
  }
}

// Export with backwards-compatible name
export const testGeminiService = testAIService;
