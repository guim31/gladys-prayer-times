// -----------------------------------------------------------------------------
// The public Aladhan API (api.aladhan.com/v1/timings), seen from this
// integration: how a configuration reads as an Aladhan request, how an Aladhan
// request reads as a configuration, and how far two timetables are.
//
// Shared by scripts/probe.mjs (live comparison) and test/aladhan.test.js
// (recorded answers in test/fixtures/aladhan/). Development tooling only: the
// container never calls Aladhan.
// -----------------------------------------------------------------------------

import { normalizeConfig } from '../src/config.js';
import { METHODS, methodFromConfig } from '../src/prayer/methods.js';
import { SHOWN_TIMES } from '../src/prayer/schedule.js';

export const API = 'https://api.aladhan.com/v1/timings';

// Aladhan's names of our times.
export const ALADHAN_KEYS = {
  imsak: 'Imsak',
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
  midnight: 'Midnight',
};

const HIGH_LATITUDE = { middle_of_the_night: 1, one_seventh: 2, angle_based: 3 };

/** Order of the Aladhan `tune` parameter. */
const TUNE_ORDER = [
  'imsak',
  'fajr',
  'sunrise',
  'dhuhr',
  'asr',
  'maghrib',
  'sunset',
  'isha',
  'midnight',
];

/**
 * Query string of the Aladhan request matching a configuration.
 * @param {object} config normalized configuration
 * @param {{ latitude: number, longitude: number }} location
 * @param {string} timeZone
 * @param {{ withOffsets?: boolean }} [options] send the method's own offsets as `tune`
 */
export function aladhanQuery(config, location, timeZone, { withOffsets = true } = {}) {
  const method = methodFromConfig(config);
  const query = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    method: String(method.aladhan.id),
    school: config.school === 'hanafi' ? '1' : '0',
    latitudeAdjustmentMethod: String(HIGH_LATITUDE[config.high_latitude_rule]),
    midnightMode:
      (config.midnight_mode === 'auto' ? method.midnight : config.midnight_mode) === 'jafari'
        ? '1'
        : '0',
    timezonestring: timeZone,
  });
  if (method.aladhan.settings) {
    query.set('methodSettings', method.aladhan.settings);
  }
  if (withOffsets && method.offsets) {
    query.set('tune', TUNE_ORDER.map((key) => method.offsets[key] ?? 0).join(','));
  }
  return query;
}

/**
 * The configuration an Aladhan request stands for (a recorded fixture).
 * @param {{ method: number, methodSettings?: string, school?: number,
 *   latitudeAdjustmentMethod?: number, midnightMode?: number }} request
 */
export function configFromAladhan(request) {
  const settings = request.methodSettings ?? null;
  const entry = Object.entries(METHODS).find(
    ([, method]) =>
      method.aladhan.id === request.method && (method.aladhan.settings ?? null) === settings,
  );
  if (!entry) {
    throw new Error(`No method matches Aladhan method ${request.method} (${settings})`);
  }
  const rule = Object.entries(HIGH_LATITUDE).find(
    ([, id]) => id === (request.latitudeAdjustmentMethod ?? 3),
  )[0];
  return normalizeConfig({
    method: entry[0],
    school: request.school === 1 ? 'hanafi' : 'shafi',
    high_latitude_rule: rule,
    midnight_mode: request.midnightMode === 1 ? 'jafari' : 'standard',
  });
}

/** Minutes from "HH:MM" `a` to "HH:MM" `b`, the shortest way around the clock. */
export function minutesBetween(a, b) {
  const toMinutes = (text) => {
    const [hours, minutes] = text.slice(0, 5).split(':').map(Number);
    return hours * 60 + minutes;
  };
  const diff = (((toMinutes(b) - toMinutes(a)) % 1440) + 1440) % 1440;
  return diff > 720 ? diff - 1440 : diff;
}

/**
 * Differences, in minutes, between our "HH:MM" times and Aladhan's timings.
 * @returns {Record<string, number>} by our key, for the times both give
 */
export function compareTimings(ours, timings) {
  const diffs = {};
  for (const key of SHOWN_TIMES) {
    const theirs = timings[ALADHAN_KEYS[key]];
    if (ours[key] && typeof theirs === 'string') {
      diffs[key] = minutesBetween(theirs, ours[key]);
    }
  }
  return diffs;
}
