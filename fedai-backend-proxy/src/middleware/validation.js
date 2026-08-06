// fedai-backend-proxy/src/middleware/validation.js
// Request validation middleware using Zod

const { z } = require('zod');
const net = require('net');

/**
 * Coordinate validation schema
 */
const coordinatesSchema = z.object({
  latitude: z.number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
});

/**
 * Language object schema
 */
const languageSchema = z.object({
  code: z.string().min(2).max(5),
  uiName: z.string(),
  geminiPromptLanguage: z.string()
});

/**
 * Image schema
 */
const imageSchema = z.object({
  base64: z.string().min(1, 'Image base64 data is required'),
  mimeType: z.enum(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'], {
    errorMap: () => ({ message: 'Invalid image MIME type. Allowed: jpeg, jpg, png, webp' })
  })
});

/**
 * Gemini analysis request schema
 */
const geminiAnalysisSchema = z.object({
  image: imageSchema,
  language: languageSchema,
  userDescription: z.string().max(5000, 'Description too long (max 5000 characters)').optional().nullable(),
  userLocation: coordinatesSchema.extend({
    city: z.string().optional(),
    country: z.string().optional(),
    source: z.string().optional()
  }).optional().nullable(),
  weatherData: z.any().optional().nullable(), // Complex structure, validate separately if needed
  environmentalData: z.any().optional().nullable(), // Complex structure, validate separately if needed
  followUpAnswer: z.string().max(2000, 'Follow-up answer too long (max 2000 characters)').optional().nullable(),
  // Multi-provider fields (must be preserved by zod parsing - do NOT strip)
  aiProvider: z.string().optional(),
  aiApiKey: z.string().optional(),
  aiBaseUrl: z.string().optional(),
  aiModel: z.string().optional()
});

/**
 * Weather/Soil/Elevation request schema
 */
const locationDataSchema = z.object({
  body: coordinatesSchema
});

/**
 * Plant ID schema
 */
const plantIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Plant ID is required')
  })
});

/**
 * Middleware factory for validating request body
 */
function validateBody(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated; // Replace with validated data
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          errorKey: 'VALIDATION_ERROR',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
}

/**
 * Middleware factory for validating request params
 */
function validateParams(schema) {
  return (req, res, next) => {
    try {
      const validated = schema.parse({ params: req.params });
      req.params = validated.params;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          errorKey: 'VALIDATION_ERROR',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
}

/**
 * Sanitize user-provided text to prevent XSS
 * Basic implementation - consider using a library like DOMPurify for more robust sanitization
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') return text;

  return text
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers like onclick=
    .trim()
    .substring(0, 10000); // Hard limit on length
}

/**
 * Middleware to sanitize text fields in request body
 */
function sanitizeTextFields(fields = []) {
  return (req, res, next) => {
    if (req.body) {
      fields.forEach(field => {
        if (req.body[field]) {
          req.body[field] = sanitizeText(req.body[field]);
        }
      });
    }
    next();
  };
}

/**
 * Convert an IPv4 string to an unsigned 32-bit integer.
 * @returns {number|null}
 */
function ipv4ToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

// Private/loopback/link-local IPv4 ranges blocked for SSRF protection.
const BLOCKED_IPV4_RANGES = [
  ['0.0.0.0/8', ipv4ToInt('0.0.0.0'), ipv4ToInt('0.255.255.255')],
  ['10.0.0.0/8', ipv4ToInt('10.0.0.0'), ipv4ToInt('10.255.255.255')],
  ['127.0.0.0/8', ipv4ToInt('127.0.0.0'), ipv4ToInt('127.255.255.255')],
  ['172.16.0.0/12', ipv4ToInt('172.16.0.0'), ipv4ToInt('172.31.255.255')],
  ['192.168.0.0/16', ipv4ToInt('192.168.0.0'), ipv4ToInt('192.168.255.255')],
  ['169.254.0.0/16', ipv4ToInt('169.254.0.0'), ipv4ToInt('169.254.255.255')]
];

/**
 * Check whether an IPv6 host literal is in a blocked range
 * (::1 loopback, :: unspecified, ::ffff:<blocked-ipv4>, fc00::/7, fe80::/10).
 * @param {string} host
 * @returns {boolean}
 */
function isBlockedIPv6(host) {
  const normalized = host.toLowerCase();

  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1' || normalized === '::') {
    return true;
  }

  // IPv4-mapped IPv6 (::ffff:127.0.0.1, ::ffff:10.0.0.1, ...) -> check mapped IPv4
  const v4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) {
    const numeric = ipv4ToInt(v4Mapped[1]);
    if (numeric !== null) {
      for (const [, min, max] of BLOCKED_IPV4_RANGES) {
        if (numeric >= min && numeric <= max) return true;
      }
    }
    return false;
  }

  // Unique local fc00::/7 -> first hextet starts with fc or fd
  // Link local fe80::/10 -> first hextet starts with fe8..feb
  const firstHextet = normalized.split(':')[0] || '';
  if (/^f[cd]/.test(firstHextet)) return true;
  if (/^fe[89ab]/.test(firstHextet)) return true;

  return false;
}

/**
 * Validate an AI provider base URL to prevent SSRF.
 * Rejects non-http(s) schemes and private/loopback/link-local IP ranges
 * (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16,
 * 0.0.0.0/8, ::1, ::, fc00::/7, fe80::/10).
 * The 'localhost' hostname is intentionally allowed so local OpenAI-compatible
 * servers (LM Studio, llama.cpp, KoboldCpp, ...) keep working.
 * @param {string} baseUrl
 * @returns {{valid: boolean, error?: string}}
 */
function validateBaseUrl(baseUrl) {
  if (!baseUrl || typeof baseUrl !== 'string') {
    return { valid: false, error: 'baseUrl must be a non-empty string' };
  }

  let url;
  try {
    url = new URL(baseUrl);
  } catch (err) {
    return { valid: false, error: 'baseUrl is not a valid URL' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { valid: false, error: `baseUrl protocol must be http or https (got "${url.protocol}")` };
  }

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const ipVersion = net.isIP(host);

  if (ipVersion === 4) {
    const numeric = ipv4ToInt(host);
    if (numeric === null) {
      return { valid: false, error: 'Invalid IPv4 address in baseUrl' };
    }
    for (const [label, min, max] of BLOCKED_IPV4_RANGES) {
      if (numeric >= min && numeric <= max) {
        return { valid: false, error: `baseUrl targets a blocked ${label} address (SSRF protection)` };
      }
    }
    return { valid: true };
  }

  if (ipVersion === 6) {
    if (isBlockedIPv6(host)) {
      return { valid: false, error: 'baseUrl targets a blocked IPv6 address (SSRF protection)' };
    }
    return { valid: true };
  }

  // Hostname (e.g. api.openai.com) - allowed. 'localhost' allowed for local AI servers.
  return { valid: true };
}

module.exports = {
  validateBody,
  validateParams,
  sanitizeText,
  sanitizeTextFields,
  validateBaseUrl,
  // Export schemas for use in routes
  schemas: {
    geminiAnalysis: geminiAnalysisSchema,
    locationData: coordinatesSchema,
    plantId: plantIdSchema,
    coordinates: coordinatesSchema,
    image: imageSchema,
    language: languageSchema
  }
};
