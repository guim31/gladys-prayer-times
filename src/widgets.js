// -----------------------------------------------------------------------------
// Dashboard widget "Prayer times": today's times, the next prayer first.
//
// Pure builder: app.js hands it a snapshot (prayer/schedule.js). The content
// stays within the core budget (8 components, 2 texts, 1 status list): a
// heading, a tile, the status list of the eight times and a caption. The next
// prayer is told by its colour and its icon (the "primary" style of a button
// does not show in dark mode, #3153 — the same caution applies here).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { MESSAGES, TEXT, TIME_NAMES, formatDuration } from './i18n.js';
import { methodFromConfig } from './prayer/methods.js';
import { SHOWN_TIMES, formatTime, hijriDate } from './prayer/schedule.js';

// Widget key, as declared in the manifest `widgets`: never renamed.
export const WIDGET = { PRAYER_TIMES: 'prayer_times' };

const ICONS = {
  imsak: 'moon',
  fajr: 'sunrise',
  sunrise: 'sun',
  dhuhr: 'sun',
  asr: 'sun',
  maghrib: 'sunset',
  isha: 'moon',
  midnight: 'moon',
};

/**
 * @param {object} options
 * @param {object|null} options.snap snapshot, null without a location
 * @param {object} options.config
 * @param {string} options.language the language of the dashboard
 * @param {number} options.now epoch ms
 */
export function buildWidgetContent({ snap, config, language, now }) {
  if (!snap) {
    return {
      ttl_seconds: 300,
      components: [{ type: 'text', variant: 'body', text: MESSAGES.noLocation[language] }],
    };
  }
  const names = TIME_NAMES[language];
  const text = TEXT[language];
  const components = [];
  if (snap.next) {
    components.push(
      {
        type: 'text',
        variant: 'heading',
        text: text.next(names[snap.next.key], formatTime(snap.next.at, snap.timeZone)),
      },
      {
        type: 'value',
        label: text.remaining,
        icon: 'clock',
        value: formatDuration(snap.minutesToNext),
        color: WIDGET_COLORS.PRIMARY,
      },
    );
  }
  const items = SHOWN_TIMES.filter((key) => snap.today[key]).map((key) => {
    const at = snap.today[key];
    const isNext = snap.next?.at.getTime() === at.getTime();
    return {
      label: names[key],
      icon: isNext ? 'bell' : ICONS[key],
      value: formatTime(at, snap.timeZone),
      // Past times fade, the next one stands out.
      color: isNext
        ? WIDGET_COLORS.SUCCESS
        : at.getTime() <= now
          ? WIDGET_COLORS.NEUTRAL
          : WIDGET_COLORS.INFO,
    };
  });
  components.push({ type: 'status', items });
  components.push({
    type: 'text',
    variant: 'caption',
    text: [hijriDate(snap.date, language), methodFromConfig(config).label[language]]
      .filter(Boolean)
      .join(' · ')
      .slice(0, 80),
  });
  // Reloaded every minute for the time left; app.js also nudges it when the
  // next prayer changes.
  return { ttl_seconds: 60, components };
}
