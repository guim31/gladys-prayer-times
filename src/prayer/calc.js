// -----------------------------------------------------------------------------
// Prayer times, computed locally from the position of the sun.
//
// The classical method every published calculator shares (the one behind the
// Aladhan API and PrayTimes.org): the sun's declination and the equation of
// time give the solar noon (Dhuhr); the hour angle at which the sun reaches a
// given depression below the horizon gives Fajr and Isha, -0.833° (refraction
// and the solar disk) gives sunrise and sunset, and the length of the shadow
// gives Asr. The low-precision solar coordinates (U.S. Naval Observatory,
// "Approximate Solar Coordinates") are accurate to well under a minute of time
// for these purposes, and match what Aladhan computes.
//
// Times are computed for one civil date of the house, in UTC, then rounded to
// the nearest minute: the caller formats them in the time zone of Gladys.
// Written from the published formulas; the results are checked against real
// Aladhan answers, against official tables and against adhan-js in the tests.
// -----------------------------------------------------------------------------

const DEG = Math.PI / 180;
const sin = (d) => Math.sin(d * DEG);
const cos = (d) => Math.cos(d * DEG);
const tan = (d) => Math.tan(d * DEG);
const arcsin = (x) => Math.asin(x) / DEG;
const arccos = (x) => Math.acos(x) / DEG;
const arctan2 = (y, x) => Math.atan2(y, x) / DEG;
const arccot = (x) => Math.atan(1 / x) / DEG;
const fix = (a, b) => {
  const r = a - b * Math.floor(a / b);
  return r < 0 ? r + b : r;
};
const fixAngle = (a) => fix(a, 360);
const fixHour = (h) => fix(h, 24);
/** Hours from `a` to `b`, going forward around the clock. */
const timeDiff = (a, b) => fixHour(b - a);

// Sun altitude of sunrise and sunset: refraction (34') and the solar radius (16').
const RISE_SET_ANGLE = 0.833;

export const SCHOOLS = { shafi: 1, hanafi: 2 }; // shadow length factor of Asr
export const HIGH_LATITUDE_RULES = ['angle_based', 'middle_of_the_night', 'one_seventh'];
export const MIDNIGHT_MODES = ['standard', 'jafari'];

/** Every time computed, in the order of the day. */
export const TIME_KEYS = [
  'imsak',
  'fajr',
  'sunrise',
  'dhuhr',
  'asr',
  'sunset',
  'maghrib',
  'isha',
  'midnight',
];

/** Julian day of a Gregorian calendar date, at 0 h UT. */
export function julianDay(year, month, day) {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

/** Declination (degrees) and equation of time (hours) of the sun at a Julian day. */
export function sunPosition(jd) {
  const d = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * d);
  const q = fixAngle(280.459 + 0.98564736 * d);
  const l = fixAngle(q + 1.915 * sin(g) + 0.02 * sin(2 * g));
  const e = 23.439 - 0.00000036 * d;
  const ra = arctan2(cos(e) * sin(l), cos(l)) / 15;
  return {
    declination: arcsin(sin(e) * sin(l)),
    equation: q / 15 - fixHour(ra),
  };
}

/**
 * Compute the times of one day.
 *
 * @param {object} options
 * @param {{ year: number, month: number, day: number }} options.date civil date of the house
 * @param {number} options.latitude
 * @param {number} options.longitude
 * @param {import('./methods.js').Method} options.method
 * @param {'shafi'|'hanafi'} [options.school]
 * @param {'angle_based'|'middle_of_the_night'|'one_seventh'} [options.highLatitudeRule]
 * @param {'standard'|'jafari'} [options.midnightMode] defaults to the method's
 * @param {number} [options.imsakMinutes] Imsak, minutes before Fajr
 * @param {Record<string, number>} [options.adjustments] user offsets in minutes, by time key
 * @param {boolean} [options.ramadan] the date falls in Ramadan (Umm al-Qura Isha)
 * @returns {Record<string, Date|null>} every TIME_KEYS entry, rounded to the minute;
 *   null when the sun never reaches the needed position (polar day or night)
 */
export function computeTimes({
  date,
  latitude,
  longitude,
  method,
  school = 'shafi',
  highLatitudeRule = 'angle_based',
  midnightMode = method.midnight,
  imsakMinutes = 10,
  adjustments = {},
  ramadan = false,
}) {
  const jDate = julianDay(date.year, date.month, date.day) - longitude / (15 * 24);

  const midDay = (time) => fixHour(12 - sunPosition(jDate + time).equation);
  const sunAngleTime = (angle, time, ccw = false) => {
    const { declination } = sunPosition(jDate + time);
    const noon = midDay(time);
    const t =
      arccos(
        (-sin(angle) - sin(declination) * sin(latitude)) / (cos(declination) * cos(latitude)),
      ) / 15;
    return noon + (ccw ? -t : t);
  };
  const asrTime = (factor, time) => {
    const { declination } = sunPosition(jDate + time);
    const angle = -arccot(factor + tan(Math.abs(latitude - declination)));
    return sunAngleTime(angle, time);
  };

  // One pass from rough first guesses (hours of local mean time) is what the
  // reference calculators do: the sun moves too little in a few hours for a
  // second pass to change the minute.
  const guess = (hours) => hours / 24;
  const t = {
    fajr: sunAngleTime(method.fajr, guess(5), true),
    sunrise: sunAngleTime(RISE_SET_ANGLE, guess(6), true),
    dhuhr: midDay(guess(12)),
    asr: asrTime(SCHOOLS[school] ?? 1, guess(13)),
    sunset: sunAngleTime(RISE_SET_ANGLE, guess(18)),
    maghrib:
      method.maghrib?.angle !== undefined ? sunAngleTime(method.maghrib.angle, guess(18)) : NaN,
    isha: method.isha.angle !== undefined ? sunAngleTime(method.isha.angle, guess(18)) : NaN,
  };

  // Local mean time of the longitude -> UTC hours of the date.
  for (const key of Object.keys(t)) {
    t[key] -= longitude / 15;
  }

  // High latitudes: when the twilight lasts all night (or Fajr would fall too
  // far from sunrise), the time is bound to a portion of the night instead.
  const night = timeDiff(t.sunset, t.sunrise);
  const portion = (angle) => {
    if (highLatitudeRule === 'middle_of_the_night') return night / 2;
    if (highLatitudeRule === 'one_seventh') return night / 7;
    return (angle / 60) * night;
  };
  const bound = (time, base, angle, ccw) => {
    const limit = portion(angle);
    const diff = ccw ? timeDiff(time, base) : timeDiff(base, time);
    return Number.isNaN(time) || diff > limit ? base + (ccw ? -limit : limit) : time;
  };
  if (!Number.isNaN(night)) {
    t.fajr = bound(t.fajr, t.sunrise, method.fajr, true);
    if (method.isha.angle !== undefined) {
      t.isha = bound(t.isha, t.sunset, method.isha.angle, false);
    }
    if (method.maghrib?.angle !== undefined) {
      t.maghrib = bound(t.maghrib, t.sunset, method.maghrib.angle, false);
    }
  }

  if (method.maghrib?.angle === undefined) {
    t.maghrib = t.sunset;
  }
  if (method.isha.minutes !== undefined) {
    const minutes =
      ramadan && method.ramadanIshaMinutes ? method.ramadanIshaMinutes : method.isha.minutes;
    t.isha = t.maghrib + minutes / 60;
  }
  t.midnight =
    midnightMode === 'jafari'
      ? t.sunset + timeDiff(t.sunset, t.fajr) / 2
      : t.sunset + timeDiff(t.sunset, t.sunrise) / 2;

  // The authority's own offsets, then the user's.
  const offsets = method.offsets ?? {};
  for (const key of Object.keys(t)) {
    t[key] += ((offsets[key] ?? 0) + (adjustments[key] ?? 0)) / 60;
  }
  // Imsak follows the Fajr the user sees.
  t.imsak = t.fajr - imsakMinutes / 60;

  const midnightUtc = Date.UTC(date.year, date.month - 1, date.day);
  const result = {};
  for (const key of TIME_KEYS) {
    const hours = t[key];
    result[key] = Number.isFinite(hours)
      ? new Date(Math.round((midnightUtc + hours * 3600000) / 60000) * 60000)
      : null;
  }
  return result;
}
