
// fedai-backend-proxy/src/api/controllers/data.controller.js

const robustFetch = require('../utils/robustFetch');
const AIProviderFactory = require('../../services/ai-providers/provider.factory');
const {
  IPAPI_CO_URL,
  IP_API_COM_URL,
  OPEN_METEO_API_BASE,
  OPEN_METEO_ARCHIVE_API_BASE,
  OPEN_ELEVATION_API_URL_PREFIX,
  OPEN_TOPO_DATA_API_URL_PREFIX,
  SOILGRIDS_API_URL_PREFIX,
  OPEN_PLANTBOOK_API_URL_PREFIX,
  GEOLOCATION_API_TIMEOUT_MS,
} = require('../utils/constants');

// IP Location fetching is now handled directly by the Next.js API route (pages/api/ip-location.ts)
const getIpLocation = async (req, res) => {
    const errors = {};

    // Primary provider: ipapi.co
    try {
        const primaryData = await robustFetch(IPAPI_CO_URL, {}, GEOLOCATION_API_TIMEOUT_MS);
        if (primaryData && !primaryData.error && primaryData.latitude && primaryData.longitude) {
            return res.json({
                latitude: primaryData.latitude,
                longitude: primaryData.longitude,
                city: primaryData.city || 'Unknown',
                country: primaryData.country_name || 'Unknown',
                countryCode: primaryData.country_code,
                serviceName: 'ipapi.co'
            });
        }
        if (primaryData && primaryData.error) {
            errors.ipapi = primaryData.reason || 'ipapi.co returned an error';
        }
    } catch (err) {
        errors.ipapi = err.message;
    }

    // Fallback provider: ip-api.com
    try {
        const fallbackData = await robustFetch(IP_API_COM_URL, {}, GEOLOCATION_API_TIMEOUT_MS);
        if (fallbackData && fallbackData.status === 'success') {
            return res.json({
                latitude: fallbackData.lat,
                longitude: fallbackData.lon,
                city: fallbackData.city,
                country: fallbackData.country,
                countryCode: fallbackData.countryCode,
                serviceName: 'ip-api.com'
            });
        }
        if (fallbackData && fallbackData.status === 'fail') {
            errors['ip-api'] = fallbackData.message || 'ip-api.com returned status: fail';
        }
    } catch (err) {
        errors['ip-api'] = err.message;
    }

    res.status(502).json({ error: 'Both IP location services failed.', details: errors });
};

// Helper function to calculate averages from daily data.
// NOTE: Open-Meteo's archive API no longer supports 'growing_degree_days' (or 'time')
// as daily variables, so growing_degree_days is computed locally from
// temperature_2m_max/min with a base temperature of 10°C:
//   gdd_day = max(0, (tmax + tmin) / 2 - 10)
// Return shape is unchanged ({ mean_temp, total_precip, gdd_sum }) so prompt.helpers.js
// and the frontend keep working. mean_temp prefers the API-provided
// temperature_2m_mean (when requested) and falls back to (tmax + tmin) / 2.
function calculateAveragesFromDaily(dailyData) {
    if (!dailyData) {
        return { mean_temp: null, total_precip: null, gdd_sum: null };
    }

    const hasMeanTemps = Array.isArray(dailyData.temperature_2m_mean) && dailyData.temperature_2m_mean.length > 0;
    const hasMaxMinTemps = Array.isArray(dailyData.temperature_2m_max) && Array.isArray(dailyData.temperature_2m_min) &&
        dailyData.temperature_2m_max.length > 0 && dailyData.temperature_2m_min.length > 0;
    const hasPrecip = Array.isArray(dailyData.precipitation_sum) && dailyData.precipitation_sum.length > 0;

    if (!hasMeanTemps && !hasMaxMinTemps && !hasPrecip) {
        return { mean_temp: null, total_precip: null, gdd_sum: null };
    }

    // Mean temperature: prefer the API-provided daily mean, else average of tmax/tmin
    let validTemps = dailyData.temperature_2m_mean?.filter(t => t !== null && t !== undefined) || [];
    if (validTemps.length === 0 && hasMaxMinTemps) {
        validTemps = dailyData.temperature_2m_max.map((tmax, i) => {
            const tmin = dailyData.temperature_2m_min[i];
            if (tmax === null || tmax === undefined || tmin === null || tmin === undefined) return null;
            return (tmax + tmin) / 2;
        }).filter(t => t !== null && t !== undefined);
    }

    const validPrecips = dailyData.precipitation_sum?.filter(p => p !== null && p !== undefined) || [];

    // Growing degree days (base 10°C) computed from daily tmax/tmin
    let gdd_sum = null;
    if (hasMaxMinTemps) {
        const validGDDs = dailyData.temperature_2m_max.map((tmax, i) => {
            const tmin = dailyData.temperature_2m_min[i];
            if (tmax === null || tmax === undefined || tmin === null || tmin === undefined) return null;
            return Math.max(0, (tmax + tmin) / 2 - 10);
        }).filter(gdd => gdd !== null && gdd !== undefined);
        if (validGDDs.length > 0) {
            gdd_sum = validGDDs.reduce((a, b) => a + b, 0);
        }
    }

    const mean_temp = validTemps.length > 0 ? validTemps.reduce((a, b) => a + b, 0) / validTemps.length : null;
    const total_precip = validPrecips.length > 0 ? validPrecips.reduce((a, b) => a + b, 0) : null;
    return { 
        mean_temp: mean_temp !== null ? parseFloat(mean_temp.toFixed(1)) : null, 
        total_precip: total_precip !== null ? parseFloat(total_precip.toFixed(1)) : null,
        gdd_sum: gdd_sum !== null ? parseFloat(gdd_sum.toFixed(1)) : null,
    };
}

// --- Weather Data Controller ---

/**
 * Keyless fallback for current weather when the Open-Meteo forecast host
 * fails (e.g. datacenter egress throttling). wttr.in needs no API key.
 * Maps its current_condition payload onto the Open-Meteo CurrentWeatherData shape.
 */
async function fetchCurrentWeatherFallback(latitude, longitude) {
  try {
    const url = `https://wttr.in/${latitude},${longitude}?format=j1`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Fedai/1.2 (plant-health-ai; +https://github.com/bnelabs/fedai)' }
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json();
    const cur = data && data.current_condition && data.current_condition[0];
    if (!cur || cur.temp_C === undefined) return null;
    return {
      temperature_2m: parseFloat(cur.temp_C),
      relative_humidity_2m: cur.humidity !== undefined ? parseFloat(cur.humidity) : null,
      precipitation: cur.precipMM !== undefined ? parseFloat(cur.precipMM) : 0,
      weather_code: cur.weatherCode !== undefined ? parseInt(cur.weatherCode, 10) : null,
      wind_speed_10m: cur.windspeedKmph !== undefined ? parseFloat(cur.windspeedKmph) : null,
      et0_fao_evapotranspiration: undefined
    };
  } catch (error) {
    console.warn(`[WEATHER_FALLBACK] wttr.in fallback failed: ${error.message}`);
    return null;
  }
}


/**
 * Ask the configured AI provider (server-side key, zero-login) for weather
 * data at a location when all keyless sources failed. Returns an object in
 * the WeatherData shape, or null on failure.
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<{current?: object, recentMonthlyAverage?: object, historicalMonthlyAverage?: object}|null>}
 */
async function askLlmForWeather(latitude, longitude) {
  try {
    const provider = AIProviderFactory.createFromEnv();
    const today = new Date().toISOString().slice(0, 10);
    const systemInstruction = `You are a weather data provider. Return ONLY a valid JSON object. Do not add commentary. If you are unsure about a value, use null.`;
    const prompt = `Provide current and recent weather for coordinates latitude ${latitude}, longitude ${longitude} (today: ${today}). Return JSON exactly in this shape:
{
  "current": {"temperature_2m": 20.5, "relative_humidity_2m": 60, "precipitation": 0, "weather_code": 1, "wind_speed_10m": 12, "et0_fao_evapotranspiration": 3.1},
  "recentMonthlyAverage": {"mean_temp": 18.2, "total_precip": 45.0, "gdd_sum": 220},
  "historicalMonthlyAverage": {"mean_temp": 17.5, "total_precip": 55.0, "gdd_sum": 200}
}
Use plausible values for the location's climate. Mark any values you are not confident about as null.`;
    const raw = await provider.generateText({ systemInstruction, prompt });
    const parsed = JSON.parse(raw.trim());
    const out = {};
    if (parsed.current && typeof parsed.current === 'object') out.current = parsed.current;
    if (parsed.recentMonthlyAverage && typeof parsed.recentMonthlyAverage === 'object') out.recentMonthlyAverage = parsed.recentMonthlyAverage;
    if (parsed.historicalMonthlyAverage && typeof parsed.historicalMonthlyAverage === 'object') out.historicalMonthlyAverage = parsed.historicalMonthlyAverage;
    if (Object.keys(out).length === 0) return null;
    console.warn(`[WEATHER_LLM_FALLBACK] Used AI provider for weather at ${latitude},${longitude}`);
    return out;
  } catch (error) {
    console.warn(`[WEATHER_LLM_FALLBACK] AI fallback failed: ${error.message}`);
    return null;
  }
}

/**
 * Ask the configured AI provider for soil properties at a location when
 * SoilGrids fails. Returns the soil data object, or null on failure.
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<object|null>}
 */
async function askLlmForSoil(latitude, longitude) {
  try {
    const provider = AIProviderFactory.createFromEnv();
    const systemInstruction = `You are a soil data provider. Return ONLY a valid JSON object. Do not add commentary. If you are unsure about a value, use null.`;
    const prompt = `Provide estimated soil properties (0-5cm depth) for coordinates latitude ${latitude}, longitude ${longitude}. Return JSON exactly in this shape:
{
  "soilPH": "6.3",
  "soilOrganicCarbon": "12.0 g/kg",
  "soilCEC": "18.0 cmolc/kg",
  "soilNitrogen": "2.5 g/kg",
  "soilSand": "40%",
  "soilSilt": "35%",
  "soilClay": "25%",
  "soilAWC": "12.0 mm"
}
Use plausible values based on the region's typical soil (e.g. SoilGrids-like estimates). Mark any values you are not confident about as null.`;
    const raw = await provider.generateText({ systemInstruction, prompt });
    const parsed = JSON.parse(raw.trim());
    if (!parsed || typeof parsed !== 'object') return null;
    console.warn(`[SOIL_LLM_FALLBACK] Used AI provider for soil at ${latitude},${longitude}`);
    return parsed;
  } catch (error) {
    console.warn(`[SOIL_LLM_FALLBACK] AI fallback failed: ${error.message}`);
    return null;
  }
}

const getWeatherData = async (req, res) => {
  const { latitude, longitude } = req.body;
  // console.log(`Received request for /api/weather for lat: ${latitude}, lon: ${longitude}`);
  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Latitude and longitude are required.' });
  }

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  try {
    const todayDate = new Date();
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(todayDate.getDate() - 1);
    const firstDayOfMonthDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);

    const today = formatDate(todayDate);
    const yesterday = formatDate(yesterdayDate);
    const firstDayOfMonth = formatDate(firstDayOfMonthDate);

    // 1. Fetch Current Weather
    const currentParams = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,et0_fao_evapotranspiration',
      timezone: 'auto', temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm',
    });
    const currentDataPromise = robustFetch(`${OPEN_METEO_API_BASE}/forecast?${currentParams.toString()}`);

    // 2. Fetch Recent Daily Weather
    let recentDailyPromise = Promise.resolve(null);
    if (firstDayOfMonthDate <= yesterdayDate) { // Only fetch if there's at least one day in the past for the current month
      const recentParams = new URLSearchParams({
        latitude: latitude.toString(), longitude: longitude.toString(),
        start_date: firstDayOfMonth, end_date: yesterday,
        // NOTE: The archive API rejects 'time' and 'growing_degree_days' as daily variables.
        // GDD is computed locally in calculateAveragesFromDaily from temperature_2m_max/min.
        // temperature_2m_mean is kept so the frontend trend chart and prompt helpers still work.
        daily: 'temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration',
        timezone: 'auto', temperature_unit: 'celsius', precipitation_unit: 'mm',
      });
      recentDailyPromise = robustFetch(`${OPEN_METEO_ARCHIVE_API_BASE}?${recentParams.toString()}`);
    }


    // 3. Fetch Historical Monthly Averages
    const historicalDataPromises = [];
    const currentMonth = todayDate.getMonth(); // 0-indexed
    const currentYear = todayDate.getFullYear();
    for (let i = 0; i < 5; i++) { // 5 past years
      const year = currentYear - (i + 1);
      const monthStr = (currentMonth + 1).toString().padStart(2, '0'); // 1-indexed month for API
      const startDateHistorical = `${year}-${monthStr}-01`;
      const endDateHistorical = formatDate(new Date(year, currentMonth + 1, 0)); // Last day of current month for that past year

      const historicalParams = new URLSearchParams({
        latitude: latitude.toString(), longitude: longitude.toString(),
        start_date: startDateHistorical, end_date: endDateHistorical,
        daily: 'temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration',
        timezone: 'auto', temperature_unit: 'celsius', precipitation_unit: 'mm',
      });
      historicalDataPromises.push(robustFetch(`${OPEN_METEO_ARCHIVE_API_BASE}?${historicalParams.toString()}`));
    }

    const [currentDataResult, recentDailyResult, ...historicalResultsSettled] = await Promise.allSettled([
        currentDataPromise, 
        recentDailyPromise, 
        ...historicalDataPromises
    ]);
    
    let recentMonthlyAverage = null;
    const recentDailyRawData = recentDailyResult.status === 'fulfilled' ? recentDailyResult.value?.daily : null;
    if (recentDailyRawData) {
        recentMonthlyAverage = calculateAveragesFromDaily(recentDailyRawData);
    }
    
    let overallHistoricalAverage = { mean_temp: null, total_precip: null, gdd_sum: null };
    const historicalDailyAverages = historicalResultsSettled
        .filter(r => r.status === 'fulfilled' && r.value?.daily)
        .map(r => calculateAveragesFromDaily(r.value.daily));

    if (historicalDailyAverages.length > 0) {
        const validHistTemps = historicalDailyAverages.map(h => h.mean_temp).filter(t => t !== null);
        const validHistPrecips = historicalDailyAverages.map(h => h.total_precip).filter(p => p !== null);
        const validHistGDDs = historicalDailyAverages.map(h => h.gdd_sum).filter(gdd => gdd !== null);

        if (validHistTemps.length > 0) overallHistoricalAverage.mean_temp = parseFloat((validHistTemps.reduce((s, v) => s + v, 0) / validHistTemps.length).toFixed(1));
        if (validHistPrecips.length > 0) overallHistoricalAverage.total_precip = parseFloat((validHistPrecips.reduce((s, v) => s + v, 0) / validHistPrecips.length).toFixed(1));
        if (validHistGDDs.length > 0) overallHistoricalAverage.gdd_sum = parseFloat((validHistGDDs.reduce((s, v) => s + v, 0) / validHistGDDs.length).toFixed(1));
    }
    
    // --- Response Structure Validation ---
    let validatedCurrent = currentDataResult.status === 'fulfilled' ? currentDataResult.value.current : null;
    if (validatedCurrent !== null && typeof validatedCurrent !== 'object') {
        console.warn(`[WEATHER_DATA_VALIDATION] Invalid 'current' data structure received. Expected object, got ${typeof validatedCurrent}. Setting to null.`);
        validatedCurrent = null;
    }

    // Keyless fallback: if the Open-Meteo forecast host failed (common on
    // datacenter egress), try wttr.in for current conditions.
    if (!validatedCurrent) {
        const fallbackCurrent = await fetchCurrentWeatherFallback(latitude, longitude);
        if (fallbackCurrent) {
            validatedCurrent = fallbackCurrent;
        }
    }


    let validatedRecentDailyRawData = recentDailyRawData;
    if (validatedRecentDailyRawData !== null && !Array.isArray(validatedRecentDailyRawData)) {
        console.warn(`[WEATHER_DATA_VALIDATION] Invalid 'recentDailyRawData' structure received. Expected array, got ${typeof validatedRecentDailyRawData}. Setting to null.`);
        validatedRecentDailyRawData = null;
    }

    let validatedRecentMonthlyAverage = (recentMonthlyAverage && (recentMonthlyAverage.mean_temp !== null || recentMonthlyAverage.total_precip !== null || recentMonthlyAverage.gdd_sum !== null)) ? recentMonthlyAverage : null;
    if (validatedRecentMonthlyAverage !== null && typeof validatedRecentMonthlyAverage !== 'object') {
        console.warn(`[WEATHER_DATA_VALIDATION] Invalid 'recentMonthlyAverage' structure received. Expected object, got ${typeof validatedRecentMonthlyAverage}. Setting to null.`);
        validatedRecentMonthlyAverage = null;
    }

    let validatedHistoricalMonthlyAverage = (overallHistoricalAverage.mean_temp !== null || overallHistoricalAverage.total_precip !== null || overallHistoricalAverage.gdd_sum !== null) ? overallHistoricalAverage : null;
    if (validatedHistoricalMonthlyAverage !== null && typeof validatedHistoricalMonthlyAverage !== 'object') {
        console.warn(`[WEATHER_DATA_VALIDATION] Invalid 'historicalMonthlyAverage' structure received. Expected object, got ${typeof validatedHistoricalMonthlyAverage}. Setting to null.`);
        validatedHistoricalMonthlyAverage = null;
    }
    // --- End Validation ---

    // AI fallback: if any weather component is still missing after all
    // keyless sources failed, ask the configured LLM (server key, zero-login)
    // for the location's weather and merge in whatever is missing.
    if (!validatedCurrent || !validatedRecentMonthlyAverage || !validatedHistoricalMonthlyAverage) {
        const llmWeather = await askLlmForWeather(latitude, longitude);
        if (llmWeather) {
            if (!validatedCurrent && llmWeather.current) validatedCurrent = llmWeather.current;
            if (!validatedRecentMonthlyAverage && llmWeather.recentMonthlyAverage) validatedRecentMonthlyAverage = llmWeather.recentMonthlyAverage;
            if (!validatedHistoricalMonthlyAverage && llmWeather.historicalMonthlyAverage) validatedHistoricalMonthlyAverage = llmWeather.historicalMonthlyAverage;
        }
    }

    res.json({
      current: validatedCurrent,
      recentDailyRawData: validatedRecentDailyRawData,
      recentMonthlyAverage: validatedRecentMonthlyAverage,
      historicalMonthlyAverage: validatedHistoricalMonthlyAverage,
      weatherDataTimestamp: new Date().toISOString()
    });

  } catch (error) {
    // console.error(`Error in /api/weather proxy for ${latitude},${longitude}:`, error);
    res.status(500).json({ error: error.message || 'Failed to fetch weather data from Open-Meteo.' });
  }
};

// --- Elevation Data Controller ---
const getElevationData = async (req, res) => {
    const { latitude, longitude } = req.body;
    // console.log(`Received request for /api/elevation for lat: ${latitude}, lon: ${longitude}`);
    if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Latitude and longitude are required.' });
    }
    try {
        // Try Open-Elevation
        try {
            const openElevationUrl = `${OPEN_ELEVATION_API_URL_PREFIX}${latitude},${longitude}`;
            const data = await robustFetch(openElevationUrl);
            if (data.results && data.results.length > 0 && data.results[0].elevation !== undefined) {
                return res.json({ elevation: `${Math.round(data.results[0].elevation)}m`, source: 'Open-Elevation' });
            }
            // console.warn('Open-Elevation returned no elevation data. Trying fallback.');
        } catch (primaryError) {
            // console.error(`Open-Elevation failed: ${primaryError.message}. Trying OpenTopoData.`);
        }
        
        // Try OpenTopoData as fallback
        const openTopoUrl = `${OPEN_TOPO_DATA_API_URL_PREFIX}${latitude},${longitude}`;
        const dataFallback = await robustFetch(openTopoUrl);
        if (dataFallback.status === 'OK' && dataFallback.results && dataFallback.results.length > 0 && dataFallback.results[0].elevation !== null) {
            return res.json({ elevation: `${Math.round(dataFallback.results[0].elevation)}m`, source: 'OpenTopoData' });
        }
        // console.warn('OpenTopoData also returned no valid elevation data.');
        res.status(503).json({ error: 'All elevation services failed to provide data.' });
    } catch (error) {
        // console.error(`Error in /api/elevation proxy for ${latitude},${longitude}:`, error);
        res.status(500).json({ error: error.message || 'Failed to fetch elevation data.' });
    }
};

// --- Soil Data Controller ---
const getSoilData = async (req, res) => {
    const { latitude, longitude } = req.body;
    // console.log(`Received request for /api/soil for lat: ${latitude}, lon: ${longitude}`);
    if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ error: 'Latitude and longitude are required.' });
    }
    
    // SoilGrids API requires separate property parameters (not comma-separated).
    // A single 9-property query takes ~5.6s on normal networks but exceeds 13s from
    // Render, so the properties are split into two smaller groups fetched in parallel
    // (Promise.allSettled) and the timeout is raised to ~25s.
    const propertyGroups = [
        ['phh2o', 'soc', 'cec', 'nitrogen'],
        ['sand', 'silt', 'clay', 'wv0033', 'wv1500'],
    ];
    const depths = '0-5cm';
    const valueType = 'mean';
    const soilGridsTimeout = GEOLOCATION_API_TIMEOUT_MS + 18000; // ~25s (was ~13s)
    const buildSoilGridsUrl = (properties) =>
        `${SOILGRIDS_API_URL_PREFIX}?lon=${longitude}&lat=${latitude}&${properties.map(p => `property=${p}`).join('&')}&depth=${depths}&value=${valueType}`;
    
    try {
        const results = await Promise.allSettled(
            propertyGroups.map(properties => robustFetch(buildSoilGridsUrl(properties), {}, soilGridsTimeout))
        );

        // Merge the layers from every group that responded successfully. If one group
        // fails (e.g. slow network), the other group's properties are still returned.
        const allLayers = [];
        const fetchErrors = [];
        for (const result of results) {
            if (result.status === 'fulfilled') {
                const data = result.value;
                if (data && data.properties && Array.isArray(data.properties.layers)) {
                    allLayers.push(...data.properties.layers);
                }
            } else if (result.reason) {
                fetchErrors.push(String(result.reason?.message || result.reason));
            }
        }

        // Handle Invalid API Response Structure
        if (allLayers.length === 0) {
            const llmSoil = await askLlmForSoil(latitude, longitude);
            if (llmSoil) {
                return res.json({
                    data: llmSoil,
                    source: 'AI-estimate',
                    dataTimestamp: new Date().toISOString()
                });
            }
            return res.status(502).json({
                error: 'SoilGrids returned an invalid response.',
                errorCode: 'SOIL_DATA_INVALID_RESPONSE',
                source: 'SoilGrids',
                ...(fetchErrors.length > 0 ? { detail: fetchErrors.join('; ') } : {}),
            });
        }
        
        // Handle "No Data At Location"
        if (allLayers.every(l => l.depths[0]?.values?.mean === null || l.depths[0]?.values?.mean === undefined)) {
            const llmSoil = await askLlmForSoil(latitude, longitude);
            if (llmSoil) {
                return res.json({
                    data: llmSoil,
                    source: 'AI-estimate',
                    dataTimestamp: new Date().toISOString()
                });
            }
            return res.status(200).json({
                error: 'Soil data is not available for this specific location.',
                errorCode: 'SOIL_DATA_NOT_AT_LOCATION',
                source: 'SoilGrids'
            });
        }

        const soilProps = {};
        let wv0033_value = null;
        let wv1500_value = null;
        
        allLayers.forEach(layer => {
            if (!layer || typeof layer !== 'object' || !layer.depths || !Array.isArray(layer.depths) || !layer.depths[0] || typeof layer.depths[0] !== 'object' || !layer.depths[0].values || typeof layer.depths[0].values !== 'object') {
                // console.warn(`// DEBUG_SOIL: Layer with unexpected depths/values structure:`, JSON.stringify(layer)); // Kept for debugging if necessary, but less verbose
                return;
            }

            const layerValue = layer.depths[0]?.values?.mean;
            if (layerValue === null || layerValue === undefined) return;

            const propName = layer.name ? String(layer.name).split('_')[0] : 'unknown';
            // if (propName === 'unknown') { // Less critical log, can be removed if too noisy
            //     console.warn(`// DEBUG_SOIL: Layer encountered with missing or invalid name:`, layer);
            // }
            switch(propName) {
                case 'phh2o': soilProps.soilPH = (layerValue / 10).toFixed(1); break;
                case 'soc': soilProps.soilOrganicCarbon = `${(layerValue / 10).toFixed(1)} g/kg`; break;
                case 'cec': soilProps.soilCEC = `${(layerValue / 10).toFixed(1)} cmolc/kg`; break;
                case 'nitrogen': soilProps.soilNitrogen = `${(layerValue / 100).toFixed(1)} g/kg`; break;
                case 'sand': soilProps.soilSand = `${(layerValue / 10).toFixed(0)}%`; break;
                case 'silt': soilProps.soilSilt = `${(layerValue / 10).toFixed(0)}%`; break;
                case 'clay': soilProps.soilClay = `${(layerValue / 10).toFixed(0)}%`; break;
                case 'wv0033': wv0033_value = layerValue; break;
                case 'wv1500': wv1500_value = layerValue; break;
            }
        });

        if (wv0033_value !== null && wv1500_value !== null && typeof wv0033_value === 'number' && typeof wv1500_value === 'number') {
            // AWC (Available Water Capacity) in mm for a 5cm layer thickness.
            // SoilGrids provides volumetric water content (wv) in cm3/cm3 (or % v/v).
            // To get mm of water in a 5cm (50mm) soil layer: (wv_field_capacity - wv_wilting_point) * layer_thickness_mm
            // wv0033 is water content at 33 kPa (often taken as field capacity)
            // wv1500 is water content at 1500 kPa (often taken as wilting point)
            // SoilGrids provides these values multiplied by 100 (e.g., 25 means 0.25 cm3/cm3).
            // So, ( (wv0033/100) - (wv1500/100) ) * 50mm
            // = (wv0033 - wv1500) / 100 * 50
            // = (wv0033 - wv1500) / 2
            // The original calculation was (wv0033_value - wv1500_value) / 20.
            // This implies that the SoilGrids wv values (wv0033_value, wv1500_value) are volumetric water content (cm³/cm³) scaled by 1000 (i.e., in permille).
            // The AWC (Available Water Capacity) is then calculated for a 5cm (50mm) soil layer depth.
            // Derivation:
            // AWC (mm) = ( (wv0033_value / 1000) - (wv1500_value / 1000) ) * 50mm layer_depth
            // AWC (mm) = (wv0033_value - wv1500_value) / 1000 * 50
            // AWC (mm) = (wv0033_value - wv1500_value) / 20
            // Sticking to this original calculation /20 for consistency with existing frontend.
            soilProps.soilAWC = `${((wv0033_value - wv1500_value) / 20).toFixed(1)} mm`;
        }

        // Standardize Success Response
        if (Object.keys(soilProps).length > 0) {
            res.json({
                data: soilProps,
                source: 'SoilGrids',
                dataTimestamp: new Date().toISOString()
            });
        } else {
            // Handle "Relevant Properties Missing" (and it wasn't a "No Data At Location" case, as that's handled above)
            return res.status(200).json({
                error: 'Could not find relevant soil properties for this location.',
                errorCode: 'SOIL_DATA_PROPERTIES_MISSING',
                source: 'SoilGrids'
            });
        }
    } catch (error) {
        console.error(`[SOIL_API_ERROR] Unhandled error in getSoilData for ${latitude},${longitude}:`, error);
        // Handle General Fetch/Processing Errors
        const llmSoil = await askLlmForSoil(latitude, longitude);
        if (llmSoil) {
            return res.json({
                data: llmSoil,
                source: 'AI-estimate',
                dataTimestamp: new Date().toISOString()
            });
        }
        res.status(500).json({
            error: 'Failed to fetch or process soil data from the provider.',
            errorCode: 'SOIL_DATA_FETCH_FAILED',
            detail: String(error.message || error)
        });
    }
};

// --- OpenPlantBook Plant Data Controller ---
const getPlantData = async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ error: 'Plant ID is required.' });
    }
    if (!process.env.OPEN_PLANTBOOK_API_KEY) {
        return res.status(503).json({ error: 'OpenPlantBook API key not configured on server.' });
    }

    const plantUrl = `${OPEN_PLANTBOOK_API_URL_PREFIX}${id}/`;
    try {
        const data = await robustFetch(plantUrl, {
            headers: { 'Authorization': `Token ${process.env.OPEN_PLANTBOOK_API_KEY}` }
        });
        
        // --- Response Structure Validation ---
        if (data === null || typeof data !== 'object' || Object.keys(data).length === 0) {
            console.warn(`[PLANTBOOK_DATA_VALIDATION] Invalid or empty response received from OpenPlantBook for ID ${id}.`);
            return res.status(502).json({
                error: 'OpenPlantBook returned an invalid or empty response.',
                errorCode: 'PLANTBOOK_INVALID_RESPONSE',
                source: 'OpenPlantBook'
            });
        }
        // --- End Validation ---

        res.json(data);
    } catch (error) {
        console.error(`[PLANTBOOK_API_ERROR] ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch plant data from OpenPlantBook.' });
    }
};


module.exports = {
  getIpLocation,
  getWeatherData,
  getElevationData,
  getSoilData,
  getPlantData,
};
