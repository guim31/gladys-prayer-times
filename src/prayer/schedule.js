// -----------------------------------------------------------------------------
// From the configuration to the times of the house, in the time zone of Gladys.
//
// The supervisor starts the container with TZ set to the time zone of Gladys:
// the civil date of the house and the "HH:MM" shown to the user are read in
// it. A date is computed on its own (no "add 24 h"), so the days around a
// daylight saving change are right.
// -----------------------------------------------------------------------------

import { computeTimes } from './calc.js';
import { methodFromConfig } from './methods.js';
import { ADJUSTABLE } from '../config.js';

/** The five daily prayers, in the order of the day. */
export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

/** The times shown and announced: the prayers, plus Imsak, sunrise and midnight. */
export const SHOWN_TIMES = [
  'imsak',
  'fajr',
  'sunrise',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
  'midnight',
];

/** The time zone the container runs in (TZ, set by the Gladys supervisor). */
export function systemTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** Civil date of an instant in a time zone. */
export function localDate(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type) => Number(parts.find((part) => part.type === type).value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** The civil date `days` after another one. */
export function addDays(date, days) {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** "05:41", 24-hour clock, in a time zone. */
export function formatTime(instant, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
}

// A Node.js built without full ICU falls back to the Gregorian calendar
// silently: the Hijri month would then be wrong, so it is not used at all.
export const HAS_UMM_AL_QURA =
  new Intl.DateTimeFormat('en-u-ca-islamic-umalqura').resolvedOptions().calendar ===
  'islamic-umalqura';

/** Hijri month of a civil date, in the Umm al-Qura calendar (9 = Ramadan); null without ICU. */
export function hijriMonth(date) {
  if (!HAS_UMM_AL_QURA) {
    return null;
  }
  const noon = new Date(Date.UTC(date.year, date.month - 1, date.day, 12));
  return Number(
    new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric', timeZone: 'UTC' })
      .formatToParts(noon)
      .find((part) => part.type === 'month').value,
  );
}

/** "3 Rabiʻ II 1448" in the user's language, for the widget; null without ICU. */
export function hijriDate(date, language) {
  if (!HAS_UMM_AL_QURA) {
    return null;
  }
  const noon = new Date(Date.UTC(date.year, date.month - 1, date.day, 12));
  return new Intl.DateTimeFormat(`${language}-u-ca-islamic-umalqura`, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(noon);
}

/**
 * The times of one civil date, as the configuration asks.
 * @param {object} config normalized configuration
 * @param {{ latitude: number, longitude: number }} location
 * @param {{ year: number, month: number, day: number }} date
 * @returns {Record<string, Date|null>}
 */
export function timesForDate(config, location, date) {
  const method = methodFromConfig(config);
  const adjustments = Object.fromEntries(ADJUSTABLE.map((key) => [key, config[`adjust_${key}`]]));
  return computeTimes({
    date,
    latitude: location.latitude,
    longitude: location.longitude,
    method,
    school: config.school,
    highLatitudeRule: config.high_latitude_rule,
    midnightMode: config.midnight_mode === 'auto' ? method.midnight : config.midnight_mode,
    imsakMinutes: config.imsak_minutes,
    adjustments,
    ramadan: hijriMonth(date) === 9,
  });
}

/**
 * Everything the device, the widget and the scene action show at an instant.
 * @param {object} config
 * @param {{ latitude: number, longitude: number }} location
 * @param {number} now epoch milliseconds
 * @param {string} timeZone
 */
export function snapshot(config, location, now, timeZone) {
  const date = localDate(new Date(now), timeZone);
  const today = timesForDate(config, location, date);
  const tomorrow = timesForDate(config, location, addDays(date, 1));
  let next = PRAYERS.map((key) => ({ key, at: today[key] })).find(
    ({ at }) => at !== null && at.getTime() > now,
  );
  if (!next && tomorrow.fajr) {
    next = { key: 'fajr', at: tomorrow.fajr };
  }
  return {
    date,
    timeZone,
    today,
    next: next ?? null,
    minutesToNext: next ? Math.ceil((next.at.getTime() - now) / 60000) : null,
  };
}
