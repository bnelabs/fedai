// fedai-backend-proxy/src/api/utils/robustFetch.js

const fetch = require('node-fetch');
const { GEOLOCATION_API_TIMEOUT_MS } = require('./constants');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');

/**
 * A robust fetch helper with a timeout mechanism and retry logic.
 * @param {string} url - The URL to fetch.
 * @param {object} options - Fetch options.
 * @param {number} timeout - Timeout in milliseconds.
 * @returns {Promise<any>} - The JSON response.
 */
async function robustFetch(url, options = {}, timeout = GEOLOCATION_API_TIMEOUT_MS) {
  const maxRetries = 3; // Number of retries
  let retryCount = 0;

  while (retryCount < maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      let agent;
      if (proxyUrl) {
        agent = url.startsWith('https') ? new HttpsProxyAgent(proxyUrl) : new HttpProxyAgent(proxyUrl);
      }

      const response = await fetch(url, {
        ...options,
        agent,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Fedai/1.2 (plant-health-ai; +https://github.com/bnelabs/fedai)',
          ...(options.headers || {})
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();

        // Don't retry on rate limit (429), auth errors (401, 403), or client errors (4xx)
        // These won't be fixed by retrying
        if (response.status === 429 || response.status === 401 || response.status === 403 ||
            (response.status >= 400 && response.status < 500)) {
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
        }

        // For server errors (5xx), retry
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
      }
      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      // Extract the HTTP status from the error message, if this is an HTTP error.
      // These are thrown above with the format: `HTTP error! status: <code>, body: ...`
      const statusMatch = error && error.message && error.message.match(/status: (\d{3})/);
      const httpStatus = statusMatch ? parseInt(statusMatch[1], 10) : null;

      // Never retry rate limit (429), auth errors (401, 403), or other client errors (4xx)
      if (httpStatus !== null && httpStatus >= 400 && httpStatus < 500) {
        // Don't retry - immediately fail and let fallback provider handle it
        throw error;
      }

      // Retryable errors: network issues, 5xx server errors, and timeouts (AbortError).
      // Timeouts used to fail immediately, which caused all-null weather/soil data on
      // slow egress hosts (e.g. Render); retrying them with the exponential backoff
      // below fixes that.
      const isTimeout = error && error.name === 'AbortError';

      // Increment retry count for retryable errors (network issues, 5xx errors, timeouts)
      retryCount++;
      if (retryCount >= maxRetries) {
        if (isTimeout) {
          throw new Error(`Request to ${url} timed out after ${timeout}ms`);
        }
        throw error;
      }

      // Exponential backoff delay: 200ms, 400ms, 800ms
      const retryDelay = Math.pow(2, retryCount) * 100;
      console.warn(`Request to ${url} failed: ${error.message}. Retrying (${retryCount}/${maxRetries}) in ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  // This line should theoretically not be reached if maxRetries is handled correctly in the catch block.
  // However, as a fallback, we throw an error.
  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries.`);
}

module.exports = robustFetch;
