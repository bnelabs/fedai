
export enum LanguageCode {
  TR = 'tr',
  EN = 'en',
  DE = 'de',
  ES = 'es',
  PT = 'pt',
  FR = 'fr',
}

export interface Language {
  code: LanguageCode;
  uiName: string;
  geminiPromptLanguage: string;
}

export enum PipelineStepId {
  IMAGE_UPLOAD = 'IMAGE_UPLOAD',
  LOCATION_DATA = 'LOCATION_DATA',
  ENVIRONMENT_DATA = 'ENVIRONMENT_DATA',
  AI_ANALYSIS = 'AI_ANALYSIS',
}

export interface PipelineStep {
  id: PipelineStepId;
  labelKey: keyof UiStrings; // Points to a key in UiStrings
  icon: React.ReactNode; // Changed to allow any valid React node
}


export interface UiStrings {
  tagline: string;
  allRightsReserved: string;
  selectLanguage: string;
  uploadImage: string;
  captureImage: string;
  clearImage: string;
  imagePreview: string;
  maxFileSizeError: (size: string) => string;
  fileTypeNotAllowedError: (types: string) => string;
  optionalDescriptionPlaceholder: string;
  analyzeButton: string;
  analyzingButton: string;
  locationInfoTitle: string; 
  locationPermissionPromptMessage: string;
  requestLocationPermissionButton: string;
  locationPermissionDeniedMessage: string; 
  locationPermissionUnavailableMessage: string; 
  locationStatusFetching: string;
  locationStatusSuccessGps: (lat: number, lon: number) => string; 
  locationStatusSuccessIp: (city: string, country: string, service: string) => string; 
  locationStatusError: string; 
  locationGpsSuccessMessage: string;
  locationIpSuccessMessage: string;
  locationErrorGeneral: string;
  locationPermissionDeniedUserMessage: string;
  locationPermissionUnavailableUserMessage: string;

  fetchingIpLocation: string;
  ipLocationSuccess: string;
  ipLocationFailed: string;
  weatherTabCurrent: string;
  weatherTabRecent: string;
  weatherTabHistorical: string;
  weatherFetching: string;
  weatherUnavailable: string;
  weatherLastUpdated: string;
  temperature: string;
  humidity: string;
  precipitation: string;
  windSpeed: string;
  weatherCondition: string;
  meanTemperature: string;
  totalPrecipitation: string;
  fiveYearAverage: string;
  evapotranspirationLabel: string;
  evapotranspirationUnit: string;
  gddLabel: string;
  gddUnit: string;
  environmentalFactorsTitle: string;
  elevation: string;
  soilData: string;
  soilPH: string;
  soilOrganicCarbon: string;
  soilCEC: string;
  soilNitrogen: string;
  soilTextureLabel: string;
  soilSandLabel: string;
  soilSiltLabel: string;
  soilClayLabel: string;
  soilAWCLabel: string;
  soilAWCUnit: string;
  soilDataSourceNote: string;
  fetchingEnvironmentalData: string;
  environmentalDataUnavailable: string;
  environmentalDataLastUpdated: string;
  apiError: string; // General API error
  apiKeyMissingError: string;
  analysisError: string; // User-friendly analysis error
  noDiseaseFound: string;
  diseaseNameLabel: string;
  definitionLabel: string;
  possibleCausesLabel: string;
  solutionsLabel: string;
  technicalAssessmentLabel: string;
  similarPastCasesLabel: string;
  solutionTypeCultural: string;
  solutionTypeBiological: string;
  solutionTypeChemicalGeneral: string;
  solutionTypeObservation: string;
  solutionTypePreventive: string;
  solutionTypeFertilizerAdjustment: string;
  applicationNotesLabel: string;
  solutionExampleBrandsLabel: string;
  solutionEstimatedBudgetLabel: string;
  consultLocalExperts: string;
  consultLocalExpertsSoil: string;
  dataConsideredLocation: string;
  dataConsideredWeather: string;
  dataConsideredEnvironmental: string;
  followUpQuestionLabel: string;
  submitAnswerButton: string;
  errorTitle: string;
  wmoWeatherCodes: { [key: number]: string };

  serviceStatusTitle: string;
  serviceStatusUp: string;
  serviceStatusDown: string;
  serviceStatusError: string;
  serviceStatusPending: string;
  serviceLocation: string;
  serviceWeather: string;
  serviceElevation: string;
  serviceSoil: string;
  serviceAI: string;

  // Pipeline Step Labels
  pipelineStepImageUpload: string;
  pipelineStepLocationData: string;
  pipelineStepEnvironmentData: string;
  pipelineStepAIAnalysis: string;
  aiAnalysisInProgressMessage: string; 

  // Added for budget localization
  solutionEstimatedBudgetLow: string;
  solutionEstimatedBudgetMedium: string;
  solutionEstimatedBudgetHigh: string;
  solutionEstimatedBudgetUnknown: string;

  // Added for tooltips and guidance
  photoTipsTitle: string;
  photoTipsContent: string; 
  showPhotoGuidelines: string;
  hidePhotoGuidelines: string;
  photoGuidelineGoodLight: string;
  photoGuidelineClearFocus: string;
  photoGuidelineAffectedPart: string;
  photoGuidelineWholePlantContext: string;
  photoGuidelineAvoidClutter: string;
  photoGuidelineMultipleAngles: string;

  whyLocationImportantTitle: string;
  whyLocationImportantContent: string;
  whyEnvironmentalDataImportantTitle: string;
  whyEnvironmentalDataImportantContent: string;
  technicalAssessmentExplanationTitle: string;
  technicalAssessmentExplanationContent: string;

  // Added for "No Disease Found" guidance
  noDiseaseGuidanceTitle: string;
  noDiseaseGuidanceInsufficientImage: string;
  noDiseaseGuidancePlantHealthy: string;
  noDiseaseGuidanceGeneralSymptoms: string;
  noDiseaseGuidanceObservationPrompt: string;
  differentialDiagnosesLabel: string; 
  imageQualityNotesLabel: string; 
  qualitativeConfidenceLabel: string; 

  // Data source disclaimer
  dataSourceDisclaimer: string;

  // Standardized error messages
  errorNetwork: string;
  errorJsonParse: string;
  errorRateLimit: string;
  errorAnalysisGeneric: string; 
  errorAnalysisTimeout: string; 

  // New UI Strings for Refactoring
  startDiagnosisButton: string;
  thinkingTextAfterImageUpload: string;
  viewMoreDetailsButton: string;
  hideMoreDetailsButton: string;
  summaryTab: string;
  solutionsTab: string;
  technicalDetailsTab: string;
  confidenceLevelLabel: string;
  confidenceHigh: string;
  confidenceMedium: string;
  confidenceLow: string;
  confidenceUnknown: string;
  weatherSummaryTitle: string; 
  environmentalSummaryTitle: string; 
  currentMonthTempTrend: string; 

  // Backend Services Dashboard
  backendDashboardTitle: string;
  serviceProviderLabel: string;
  apiKeyManagementLabel: string;
  statusLabel: string;
  aiServiceTitle: string;
  geminiModelInfo: string;
  geminiKeyInfo: string;
  ipLocationServiceTitle: string;
  ipLocationProvidersInfo: string;
  ipLocationKeyInfo: string;
  weatherServiceTitle: string;
  weatherProviderInfo: string;
  weatherKeyInfo: string;
  elevationServiceTitle: string;
  elevationProvidersInfo: string;
  elevationKeyInfo: string;
  soilServiceTitle: string;
  soilProviderInfo: string;
  soilKeyInfo: string;
  howToUpdateConfigText: string;
  switchToDiagnosisViewButton: string;
  switchToDashboardViewButton: string;

  // Confirmation dialog for leaving diagnosis
  leaveDiagnosisConfirmationTitle: string;
  leaveDiagnosisConfirmationMessage: string;
  confirmButtonLabel: string; // For modal
  cancelButtonLabel: string;  // For modal


  // Newly added for centralization
  localEnvironmentInsightsTitle: string;
  typeYourAnswerPlaceholder: string;
  noSpecificSolutionsFoundTitle: string;
  noSpecificSolutionsFoundMessage: string;
  weatherDataUnavailableNoLocation: string;
  currentWeatherInfoUnavailable: string;
  envDataUnavailableNoLocation: string;
}

export interface AllUiStrings {
  [LanguageCode.TR]: UiStrings;
  [LanguageCode.EN]: UiStrings;
  [LanguageCode.DE]: UiStrings;
  [LanguageCode.ES]: UiStrings;
  [LanguageCode.PT]: UiStrings;
  [LanguageCode.FR]: UiStrings;
}

// For Pipeline steps, they might not be in AllUiStrings directly if they are only in EN/TR
export interface PipelineUiStrings {
  [LanguageCode.TR]: Pick<UiStrings, 'pipelineStepImageUpload' | 'pipelineStepLocationData' | 'pipelineStepEnvironmentData' | 'pipelineStepAIAnalysis'>;
  [LanguageCode.EN]: Pick<UiStrings, 'pipelineStepImageUpload' | 'pipelineStepLocationData' | 'pipelineStepEnvironmentData' | 'pipelineStepAIAnalysis'>;
  // Add other languages here if their pipeline strings are fully translated and not stubs
  [LanguageCode.DE]: Pick<UiStrings, 'pipelineStepImageUpload' | 'pipelineStepLocationData' | 'pipelineStepEnvironmentData' | 'pipelineStepAIAnalysis'>;
  [LanguageCode.ES]: Pick<UiStrings, 'pipelineStepImageUpload' | 'pipelineStepLocationData' | 'pipelineStepEnvironmentData' | 'pipelineStepAIAnalysis'>;
  [LanguageCode.PT]: Pick<UiStrings, 'pipelineStepImageUpload' | 'pipelineStepLocationData' | 'pipelineStepEnvironmentData' | 'pipelineStepAIAnalysis'>;
  [LanguageCode.FR]: Pick<UiStrings, 'pipelineStepImageUpload' | 'pipelineStepLocationData' | 'pipelineStepEnvironmentData' | 'pipelineStepAIAnalysis'>;
}


export type LocationPermissionState = 'initial' | 'prompt' | 'checking' | 'granted' | 'denied' | 'unavailable';

export interface UserLocation {
  latitude: number;
  longitude: number;
  source: 'gps' | 'ip' | 'manual';
  city?: string;
  country?: string; 
  countryCode?: string; 
  accuracyMessage?: string; 
}

export interface CurrentWeatherData {
  temperature_2m: number;
  relative_humidity_2m: number;
  precipitation: number;
  weather_code: number;
  wind_speed_10m: number;
  et0_fao_evapotranspiration?: number;
}

export interface DailyWeatherData {
  temperature_2m_mean: number[];
  precipitation_sum: number[];
  growing_degree_days?: number[];
  time: string[]; // Array of date strings 'YYYY-MM-DD'
}

export interface MonthlyAverageData {
  mean_temp: number | null;
  total_precip: number | null;
  gdd_sum?: number | null;
}

export interface WeatherData {
  current?: CurrentWeatherData;
  recentDailyRawData?: DailyWeatherData; // Kept for potential use like sparklines
  recentMonthlyAverage?: MonthlyAverageData;
  historicalMonthlyAverage?: MonthlyAverageData;
  errorKey?: keyof UiStrings | null; 
  error?: string; 
  weatherDataTimestamp?: string;
}

export interface EnvironmentalData {
  elevation?: string;
  soilPH?: string;
  soilOrganicCarbon?: string;
  soilCEC?: string;
  soilNitrogen?: string;
  soilSand?: string;
  soilSilt?: string;
  soilClay?: string;
  soilAWC?: string;
  errorKey?: keyof UiStrings | null; 
  error?: string; 
  dataTimestamp?: string;
}

export interface SolutionDetail {
  type: "cultural" | "biological" | "chemical_general" | "observation" | "preventive" | "fertilizer_adjustment";
  description: string;
  applicationNotes?: string;
  exampleBrands?: string[];
  estimatedBudget?: "BUDGET_LOW" | "BUDGET_MEDIUM" | "BUDGET_HIGH" | "BUDGET_UNKNOWN" | string; 
}

export interface QualitativeConfidenceData {
  levelKey: 'CONFIDENCE_HIGH' | 'CONFIDENCE_MEDIUM' | 'CONFIDENCE_LOW' | 'CONFIDENCE_UNKNOWN';
  justification: string | null;
}

export interface DiseaseInfo {
  diseaseName: string | null;
  definition: string | null;
  possibleCauses: string[];
  structuredSolutions: SolutionDetail[];
  aiWeatherRelevance: string | null;
  similarPastCases?: string | null;
  error: string | null; 
  errorKey?: keyof UiStrings | 'API_KEY_MISSING' | 'ANALYSIS_ERROR' | 'NETWORK_ERROR' | 'JSON_PARSE_ERROR' | 'RATE_LIMIT_ERROR' | 'ANALYSIS_TIMEOUT_ERROR' | null; 
  followUpQuestion: string | null;
  locationConsidered: boolean;
  weatherConsidered: boolean;
  environmentalDataConsidered: boolean;
  imageQualityNotes?: string | null;
  differentialDiagnoses?: Array<{ name: string; justification: string; }> | null;
  qualitativeConfidence: QualitativeConfidenceData | null; // Uses the updated QualitativeConfidenceData
  errorCode?: 'NO_DISEASE_PLANT_HEALTHY' | 'NO_DISEASE_IMAGE_INSUFFICIENT' | 'NO_DISEASE_GENERAL_SYMPTOMS' | null;
  isErrorState?: boolean;
}

export interface ImageFile {
  base64: string;
  mimeType: string;
  name: string;
  previewUrl: string;
}

export interface ServiceStatus {
  status: 'UP' | 'DOWN' | 'ERROR' | 'PENDING';
  details?: string;
}

export interface TestServiceResult {
  status: 'UP' | 'DOWN' | 'ERROR';
  details?: string;
}

export interface ServiceStatusInfo extends ServiceStatus { 
  id: string; 
  displayNameKey: keyof UiStrings;
}

export interface ConfidenceGaugeProps {
  qualitativeConfidenceData: QualitativeConfidenceData | null; // Updated to use QualitativeConfidenceData
  className?: string;
}

export type ConfidenceLevel = 'High' | 'Moderate' | 'Low' | 'Unknown';
export type AppView = 'diagnosis' | 'management';