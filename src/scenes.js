// -----------------------------------------------------------------------------
// Scene action "Get the prayer times": today's or tomorrow's times as scene
// variables, for a morning announcement ("Fajr at 06:12, Dhuhr at 13:47…") or
// a message. Read-only: it changes nothing, so it fires no event either.
// -----------------------------------------------------------------------------

import { TIME_NAMES } from './i18n.js';
import {
  SHOWN_TIMES,
  addDays,
  formatTime,
  localDate,
  snapshot,
  timesForDate,
} from './prayer/schedule.js';

// Scene action key, as declared in the manifest `scene_actions`: never renamed.
export const SCENE_ACTION = { GET_TIMES: 'get_prayer_times' };

/**
 * The outputs of `get_prayer_times` (declared in the manifest).
 * @param {object} options
 * @param {{ day?: string }} options.fields 'today' (default) or 'tomorrow'
 */
export function getTimesOutputs({ fields, config, location, now, timeZone }) {
  const tomorrow = fields?.day === 'tomorrow';
  const date = addDays(localDate(new Date(now), timeZone), tomorrow ? 1 : 0);
  const times = timesForDate(config, location, date);
  const outputs = {};
  for (const key of SHOWN_TIMES) {
    outputs[key] = times[key] ? formatTime(times[key], timeZone) : '';
  }
  const snap = snapshot(config, location, now, timeZone);
  outputs.next_prayer = snap.next ? TIME_NAMES[config.language][snap.next.key] : '';
  outputs.next_prayer_time = snap.next ? formatTime(snap.next.at, timeZone) : '';
  outputs.minutes_to_next = snap.minutesToNext ?? 0;
  return outputs;
}
