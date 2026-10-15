// -----------------------------------------------------------------------------
// Scene triggers: "it is time for <prayer>" and "<prayer> in N minutes".
//
// Scene filters only compare for equality, so "N minutes before" cannot be a
// threshold: the container fires one `prayer_upcoming` event per offset of
// UPCOMING_OFFSETS, and the scene author picks the offset (a required filter).
// That is at most 8 × 8 = 64 events a day, far below the 300 events a minute
// the core accepts.
//
// The clock calls dueEvents() once a minute with the window elapsed since its
// last call: an event is due when its instant falls in (from, to]. The times
// of yesterday, today and tomorrow are scanned, so the midnight of the night
// that started yesterday and the reminders an hour before tomorrow's Fajr are
// found too.
// -----------------------------------------------------------------------------

import { TIME_NAMES } from './i18n.js';
import { SHOWN_TIMES, addDays, formatTime, localDate, timesForDate } from './prayer/schedule.js';

// Trigger keys, as declared in the manifest `scene_triggers`: never renamed.
export const TRIGGER = {
  PRAYER_TIME: 'prayer_time',
  PRAYER_UPCOMING: 'prayer_upcoming',
};

/** Minutes before a time at which `prayer_upcoming` fires (the manifest select options). */
export const UPCOMING_OFFSETS = [5, 10, 15, 20, 30, 45, 60];

// A minute tick that comes late (a busy host, a clock change) still fires
// what it missed, up to this delay: an adhan an hour late is worse than none.
export const MAX_LATENESS_MS = 2 * 60 * 1000;

/**
 * The scene events due in (from, to], oldest first.
 * @param {object} options
 * @param {object} options.config normalized configuration
 * @param {{ latitude: number, longitude: number }} options.location
 * @param {number} options.from epoch ms, excluded
 * @param {number} options.to epoch ms, included
 * @param {string} options.timeZone
 * @returns {Array<{ id: string, at: number, key: string, data: object }>} `id` names the
 *   date, the time and the offset, not the instant: a time moved by a new
 *   configuration is not announced twice the same day.
 */
export function dueEvents({ config, location, from, to, timeZone }) {
  const start = Math.max(from, to - MAX_LATENESS_MS);
  const names = TIME_NAMES[config.language];
  const today = localDate(new Date(to), timeZone);
  const events = [];
  for (const offsetDays of [-1, 0, 1]) {
    const date = addDays(today, offsetDays);
    const day = `${date.year}-${date.month}-${date.day}`;
    const times = timesForDate(config, location, date);
    for (const key of SHOWN_TIMES) {
      const at = times[key]?.getTime();
      if (at === undefined) {
        continue;
      }
      const data = {
        prayer: key,
        prayer_name: names[key],
        time: formatTime(times[key], timeZone),
      };
      const candidates = [
        { id: `${day}:${key}`, at, key: TRIGGER.PRAYER_TIME, data },
        ...UPCOMING_OFFSETS.map((minutes) => ({
          id: `${day}:${key}:-${minutes}`,
          at: at - minutes * 60000,
          key: TRIGGER.PRAYER_UPCOMING,
          data: { ...data, minutes_before: minutes },
        })),
      ];
      events.push(...candidates.filter((event) => event.at > start && event.at <= to));
    }
  }
  return events.sort((a, b) => a.at - b.at);
}
