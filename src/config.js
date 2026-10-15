// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user from the `config_schema` of
// `gladys-assistant-integration.json`. This module holds the defaults (they
// MUST match the manifest `default` values, see test/manifest.test.js) and
// turns the received object into checked, typed values, so the rest of the
// code never deals with an empty string or an out-of-range number.
// -----------------------------------------------------------------------------

import { METHOD_KEYS } from './prayer/methods.js';
import { HIGH_LATITUDE_RULES, MIDNIGHT_MODES } from './prayer/calc.js';

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// The times a user can shift by a few minutes, to match a mosque timetable.
export const ADJUSTABLE = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const MAX_ADJUSTMENT = 60;

export const DEFAULT_CONFIG = {
  // Empty: the first Gladys house with coordinates.
  house: '',
  // Typed coordinates (strings: the number fields of Gladys accept integers only).
  latitude: '',
  longitude: '',
  method: 'mwl',
  school: 'shafi',
  high_latitude_rule: 'angle_based',
  // 'auto': the method's own convention (Jafari for the Shia methods).
  midnight_mode: 'auto',
  custom_fajr_angle: '18',
  custom_isha_angle: '17',
  custom_isha_minutes: 0,
  imsak_minutes: 10,
  adjust_fajr: 0,
  adjust_sunrise: 0,
  adjust_dhuhr: 0,
  adjust_asr: 0,
  adjust_maghrib: 0,
  adjust_isha: 0,
  language: 'fr',
};

/**
 * A decimal typed by hand: "48.85", "48,85" or a number.
 * @returns {number|null} null when empty or not a number
 */
export function parseDecimal(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const text = value.trim().replace(',', '.');
  if (!/^[-+]?\d+(\.\d+)?$/.test(text)) {
    return null;
  }
  return Number(text);
}

const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

function integerIn(value, min, max, fallback) {
  const number = Number(value);
  if (value === '' || value === null || value === undefined || !Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

function decimalIn(value, min, max, fallback) {
  const number = parseDecimal(value);
  return number === null || number < min || number > max ? fallback : number;
}

/**
 * Merge the user config with the defaults, and check every value.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const latitude = decimalIn(raw.latitude, -90, 90, null);
  const longitude = decimalIn(raw.longitude, -180, 180, null);
  const config = {
    house: typeof raw.house === 'string' ? raw.house : DEFAULT_CONFIG.house,
    // Both or none: a single coordinate is no location.
    latitude: latitude !== null && longitude !== null ? latitude : null,
    longitude: latitude !== null && longitude !== null ? longitude : null,
    method: oneOf(raw.method, METHOD_KEYS, DEFAULT_CONFIG.method),
    school: oneOf(raw.school, ['shafi', 'hanafi'], DEFAULT_CONFIG.school),
    high_latitude_rule: oneOf(
      raw.high_latitude_rule,
      HIGH_LATITUDE_RULES,
      DEFAULT_CONFIG.high_latitude_rule,
    ),
    midnight_mode: oneOf(
      raw.midnight_mode,
      ['auto', ...MIDNIGHT_MODES],
      DEFAULT_CONFIG.midnight_mode,
    ),
    custom_fajr_angle: decimalIn(raw.custom_fajr_angle, 1, 30, 18),
    custom_isha_angle: decimalIn(raw.custom_isha_angle, 1, 30, 17),
    custom_isha_minutes: integerIn(raw.custom_isha_minutes, 0, 180, 0),
    imsak_minutes: integerIn(raw.imsak_minutes, 0, 60, DEFAULT_CONFIG.imsak_minutes),
    language: oneOf(raw.language, LANGUAGES, DEFAULT_CONFIG.language),
  };
  for (const key of ADJUSTABLE) {
    config[`adjust_${key}`] = integerIn(raw[`adjust_${key}`], -MAX_ADJUSTMENT, MAX_ADJUSTMENT, 0);
  }
  return config;
}
