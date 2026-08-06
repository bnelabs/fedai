
import { LanguageCode } from './types';

// Backend API Base URL
// In development: Uses Vite proxy to localhost:3001
// In production: Uses environment variable or falls back to relative paths
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// API Endpoints - Proxied through backend, direct URLs removed from frontend constants.
// export const OPEN_METEO_API_BASE = 'https://api.open-meteo.com/v1';
// export const OPEN_METEO_ARCHIVE_API_BASE = 'https://archive-api.open-meteo.com/v1/archive';
// export const IPAPI_CO_URL = 'https://ipapi.co/json/';
// export const IP_API_COM_URL = 'https://ip-api.com/json/?fields=status,message,country,countryCode,regionName,city,lat,lon,timezone,query';
// export const OPEN_ELEVATION_API_URL_PREFIX = 'https://api.open-elevation.com/api/v1/lookup?locations=';
// export const OPEN_TOPO_DATA_API_URL_PREFIX = 'https://api.opentopodata.org/v1/etopo1?locations=';
// export const SOILGRIDS_API_URL_PREFIX = 'https://rest.soilgrids.org/soilgrids/v2.0/properties/query';

// Cache Keys & Durations
export const CACHE_KEY_IP_LOCATION = 'fedai-ip-location';
export const CACHE_DURATION_IP_LOCATION_MS = 6 * 60 * 60 * 1000; // 6 hours

export const CACHE_PREFIX_WEATHER = 'fedai-weather-';
export const CACHE_DURATION_WEATHER_MS = 1 * 60 * 60 * 1000; // 1 hour

export const CACHE_PREFIX_ELEVATION = 'fedai-elevation-';
export const CACHE_DURATION_ELEVATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export const CACHE_PREFIX_SOIL = 'fedai-soil-';
export const CACHE_DURATION_SOIL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Versioned: v2 invalidates stale cached UiStrings objects from older deploys
// whose shape may differ (e.g. keys that used to be strings are now functions).
export const TRANSLATION_CACHE_PREFIX = 'fedai-translation-v2-';
export const TRANSLATION_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 1 day

export const CACHE_THROTTLE_DELAY_MS = 500; // Delay for throttling localStorage writes

// Image Input Configuration
export const MAX_IMAGE_FILE_SIZE_MB = 5;
export const MAX_IMAGE_FILE_SIZE_BYTES = MAX_IMAGE_FILE_SIZE_MB * 1024 * 1024;
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const IMAGE_MAX_DIMENSION_PX = 1024;
export const IMAGE_COMPRESSION_QUALITY = 0.85;

// Gemini API Configuration (related to proxy interaction)
export const GEMINI_ANALYSIS_TIMEOUT_MS = 90000; // 90 seconds for main analysis

// Geolocation
export const GEOLOCATION_API_TIMEOUT_MS = 7000; // For IP and Elevation services primarily (timeout for proxy calls)
export const GEOLOCATION_HIGH_ACCURACY_TIMEOUT_MS = 10000; // For direct navigator.geolocation
export const GEOLOCATION_MAXIMUM_AGE_MS = 60000; // For direct navigator.geolocation

// Service Test Timeouts
export const SERVICE_TEST_TIMEOUT_MS = 5000; // General timeout for testing proxied services
export const GEMINI_TEST_TIMEOUT_MS = 10000; // Timeout for testing Gemini proxy status

// Default Language
export const DEFAULT_LANGUAGE_CODE = LanguageCode.TR;

// Local Storage Keys
export const LOCAL_STORAGE_LANGUAGE_KEY = 'fedai-lang';