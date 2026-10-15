// -----------------------------------------------------------------------------
// The "Prayer times" device: one per installation, for the configured house.
//
// Its external_id is fixed ("home"): changing the house or the method changes
// the values, never the device, so the user's scenes and dashboards keep it.
// Gladys has no time-of-day feature type, so the times are `text` features
// ("05:41"); the time left is a `duration` in minutes, not historized (it
// changes every minute and says nothing once past).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { DEVICE_NAMES, TIME_NAMES } from './i18n.js';
import { SHOWN_TIMES, formatTime } from './prayer/schedule.js';

export const DEVICE_TYPE = 'prayer-times';
export const PLATFORM_ID = 'home';

// Feature keys: stored by Gladys, never renamed.
export const FEATURE = {
  NEXT_PRAYER: 'next_prayer',
  NEXT_PRAYER_TIME: 'next_prayer_time',
  MINUTES_TO_NEXT: 'minutes_to_next',
};

// The longest wait for the next prayer: from Isha to the next Fajr, a day at most.
const MAX_MINUTES = 1440;

export const deviceIds = (gladys) => gladys.externalIds(DEVICE_TYPE, PLATFORM_ID);

function textFeature(ids, key, name) {
  return {
    name,
    external_id: ids.feature(key),
    category: DEVICE_FEATURE_CATEGORIES.TEXT,
    type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
    read_only: true,
    has_feedback: false,
    keep_history: false,
    // NOT NULL in Gladys, text included ("Add to Gladys" fails without them).
    min: 0,
    max: 0,
  };
}

/** The discovery payload (names in the configured language, frozen at creation). */
export function buildDevice(gladys, config) {
  const ids = deviceIds(gladys);
  const names = DEVICE_NAMES[config.language];
  const times = TIME_NAMES[config.language];
  return {
    name: names.device,
    external_id: ids.device,
    // The container refreshes the states itself every minute (Gladys#3198:
    // the core cannot be trusted to poll); onPoll is the fallback.
    should_poll: true,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
    features: [
      ...SHOWN_TIMES.map((key) => textFeature(ids, key, times[key])),
      textFeature(ids, FEATURE.NEXT_PRAYER, names.next_prayer),
      textFeature(ids, FEATURE.NEXT_PRAYER_TIME, names.next_prayer_time),
      {
        name: names.minutes_to_next,
        external_id: ids.feature(FEATURE.MINUTES_TO_NEXT),
        category: DEVICE_FEATURE_CATEGORIES.DURATION,
        type: DEVICE_FEATURE_TYPES.DURATION.INTEGER,
        unit: DEVICE_FEATURE_UNITS.MINUTES,
        read_only: true,
        has_feedback: false,
        keep_history: false,
        min: 0,
        max: MAX_MINUTES,
      },
    ],
  };
}

/**
 * The states of the device for a snapshot (see prayer/schedule.js). A time
 * the sun does not give (polar day or night) is left out: a text state is
 * never empty.
 */
export function deviceStates(gladys, snap, config) {
  const ids = deviceIds(gladys);
  const states = [];
  for (const key of SHOWN_TIMES) {
    if (snap.today[key]) {
      states.push({
        device_feature_external_id: ids.feature(key),
        text: formatTime(snap.today[key], snap.timeZone),
      });
    }
  }
  if (snap.next) {
    states.push(
      {
        device_feature_external_id: ids.feature(FEATURE.NEXT_PRAYER),
        text: TIME_NAMES[config.language][snap.next.key],
      },
      {
        device_feature_external_id: ids.feature(FEATURE.NEXT_PRAYER_TIME),
        text: formatTime(snap.next.at, snap.timeZone),
      },
      {
        device_feature_external_id: ids.feature(FEATURE.MINUTES_TO_NEXT),
        state: Math.min(MAX_MINUTES, snap.minutesToNext),
      },
    );
  }
  return states;
}
