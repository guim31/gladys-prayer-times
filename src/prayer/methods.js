// -----------------------------------------------------------------------------
// Calculation methods: the twilight angles (or fixed intervals) each authority
// uses for Fajr and Isha, Maghrib when it is not plain sunset, and the night
// midpoint convention.
//
// The parameters are those of the public Aladhan API (the service the Home
// Assistant integration calls), so a user can compare the two; `aladhan` is the
// API method id `scripts/probe.mjs` asks for. Two exceptions carry the offsets
// their authority publishes on top of the angles (Turkey's Diyanet and Dubai's
// Awqaf, from batoulapps/adhan-js, MIT), checked against the official tables in
// test/calc.test.js.
//
// The keys are stored in the users' configuration: never rename one.
// -----------------------------------------------------------------------------

/**
 * @typedef {object} Method
 * @property {number} fajr Sun depression angle of Fajr, in degrees
 * @property {{ angle?: number, minutes?: number }} isha angle, or minutes after Maghrib
 * @property {{ angle?: number }} [maghrib] angle below the horizon; sunset when absent
 * @property {'standard'|'jafari'} midnight night midpoint convention
 * @property {Record<string, number>} [offsets] minutes added per time, by the authority
 * @property {number} [ramadanIshaMinutes] Isha interval during Ramadan (Umm al-Qura)
 * @property {{ id: number, settings?: string, tune?: string }} aladhan the API equivalent
 * @property {Record<string, string>} label
 */

/** @type {Record<string, Method>} */
export const METHODS = {
  mwl: {
    fajr: 18,
    isha: { angle: 17 },
    midnight: 'standard',
    aladhan: { id: 3 },
    label: {
      en: 'Muslim World League (18° / 17°)',
      fr: 'Ligue islamique mondiale (18° / 17°)',
      de: 'Islamische Weltliga (18° / 17°)',
      es: 'Liga Mundial Musulmana (18° / 17°)',
    },
  },
  isna: {
    fajr: 15,
    isha: { angle: 15 },
    midnight: 'standard',
    aladhan: { id: 2 },
    label: {
      en: 'ISNA, North America (15° / 15°)',
      fr: 'ISNA, Amérique du Nord (15° / 15°)',
      de: 'ISNA, Nordamerika (15° / 15°)',
      es: 'ISNA, Norteamérica (15° / 15°)',
    },
  },
  egypt: {
    fajr: 19.5,
    isha: { angle: 17.5 },
    midnight: 'standard',
    aladhan: { id: 5 },
    label: {
      en: 'Egyptian Survey Authority (19.5° / 17.5°)',
      fr: 'Autorité égyptienne (19,5° / 17,5°)',
      de: 'Ägyptische Vermessungsbehörde (19,5° / 17,5°)',
      es: 'Autoridad egipcia (19,5° / 17,5°)',
    },
  },
  umm_al_qura: {
    fajr: 18.5,
    isha: { minutes: 90 },
    ramadanIshaMinutes: 120,
    midnight: 'standard',
    aladhan: { id: 4 },
    label: {
      en: 'Umm al-Qura, Makkah (18.5° / 90 min)',
      fr: 'Umm al-Qura, La Mecque (18,5° / 90 min)',
      de: 'Umm al-Qura, Mekka (18,5° / 90 min)',
      es: 'Umm al-Qura, La Meca (18,5° / 90 min)',
    },
  },
  karachi: {
    fajr: 18,
    isha: { angle: 18 },
    midnight: 'standard',
    aladhan: { id: 1 },
    label: {
      en: 'University of Karachi (18° / 18°)',
      fr: 'Université de Karachi (18° / 18°)',
      de: 'Universität Karatschi (18° / 18°)',
      es: 'Universidad de Karachi (18° / 18°)',
    },
  },
  uoif: {
    fajr: 12,
    isha: { angle: 12 },
    midnight: 'standard',
    aladhan: { id: 12 },
    label: {
      en: 'France, UOIF (12° / 12°)',
      fr: 'France, UOIF (12° / 12°)',
      de: 'Frankreich, UOIF (12° / 12°)',
      es: 'Francia, UOIF (12° / 12°)',
    },
  },
  france_15: {
    fajr: 15,
    isha: { angle: 15 },
    midnight: 'standard',
    aladhan: { id: 99, settings: '15,null,15' },
    label: {
      en: 'France, 15° / 15°',
      fr: 'France, 15° / 15°',
      de: 'Frankreich, 15° / 15°',
      es: 'Francia, 15° / 15°',
    },
  },
  france_18: {
    fajr: 18,
    isha: { angle: 18 },
    midnight: 'standard',
    aladhan: { id: 99, settings: '18,null,18' },
    label: {
      en: 'France, 18° / 18°',
      fr: 'France, 18° / 18°',
      de: 'Frankreich, 18° / 18°',
      es: 'Francia, 18° / 18°',
    },
  },
  turkey: {
    fajr: 18,
    isha: { angle: 17 },
    midnight: 'standard',
    offsets: { sunrise: -7, dhuhr: 5, asr: 4, maghrib: 7 },
    aladhan: { id: 13 },
    label: {
      en: 'Turkey, Diyanet',
      fr: 'Turquie, Diyanet',
      de: 'Türkei, Diyanet',
      es: 'Turquía, Diyanet',
    },
  },
  dubai: {
    fajr: 18.2,
    isha: { angle: 18.2 },
    midnight: 'standard',
    offsets: { sunrise: -3, dhuhr: 3, asr: 3, maghrib: 3 },
    aladhan: { id: 16 },
    label: {
      en: 'Dubai, Awqaf (18.2°)',
      fr: 'Dubaï, Awqaf (18,2°)',
      de: 'Dubai, Awqaf (18,2°)',
      es: 'Dubái, Awqaf (18,2°)',
    },
  },
  gulf: {
    fajr: 19.5,
    isha: { minutes: 90 },
    midnight: 'standard',
    aladhan: { id: 8 },
    label: {
      en: 'Gulf region (19.5° / 90 min)',
      fr: 'Région du Golfe (19,5° / 90 min)',
      de: 'Golfregion (19,5° / 90 min)',
      es: 'Región del Golfo (19,5° / 90 min)',
    },
  },
  kuwait: {
    fajr: 18,
    isha: { angle: 17.5 },
    midnight: 'standard',
    aladhan: { id: 9 },
    label: {
      en: 'Kuwait (18° / 17.5°)',
      fr: 'Koweït (18° / 17,5°)',
      de: 'Kuwait (18° / 17,5°)',
      es: 'Kuwait (18° / 17,5°)',
    },
  },
  qatar: {
    fajr: 18,
    isha: { minutes: 90 },
    midnight: 'standard',
    aladhan: { id: 10 },
    label: {
      en: 'Qatar (18° / 90 min)',
      fr: 'Qatar (18° / 90 min)',
      de: 'Katar (18° / 90 min)',
      es: 'Catar (18° / 90 min)',
    },
  },
  singapore: {
    fajr: 20,
    isha: { angle: 18 },
    midnight: 'standard',
    aladhan: { id: 11 },
    label: {
      en: 'Singapore, MUIS (20° / 18°)',
      fr: 'Singapour, MUIS (20° / 18°)',
      de: 'Singapur, MUIS (20° / 18°)',
      es: 'Singapur, MUIS (20° / 18°)',
    },
  },
  jakim: {
    fajr: 20,
    isha: { angle: 18 },
    midnight: 'standard',
    aladhan: { id: 17 },
    label: {
      en: 'Malaysia, JAKIM (20° / 18°)',
      fr: 'Malaisie, JAKIM (20° / 18°)',
      de: 'Malaysia, JAKIM (20° / 18°)',
      es: 'Malasia, JAKIM (20° / 18°)',
    },
  },
  kemenag: {
    fajr: 20,
    isha: { angle: 18 },
    midnight: 'standard',
    aladhan: { id: 20 },
    label: {
      en: 'Indonesia, Kemenag (20° / 18°)',
      fr: 'Indonésie, Kemenag (20° / 18°)',
      de: 'Indonesien, Kemenag (20° / 18°)',
      es: 'Indonesia, Kemenag (20° / 18°)',
    },
  },
  tunisia: {
    fajr: 18,
    isha: { angle: 18 },
    midnight: 'standard',
    aladhan: { id: 18 },
    label: {
      en: 'Tunisia (18° / 18°)',
      fr: 'Tunisie (18° / 18°)',
      de: 'Tunesien (18° / 18°)',
      es: 'Túnez (18° / 18°)',
    },
  },
  russia: {
    fajr: 16,
    isha: { angle: 15 },
    midnight: 'standard',
    aladhan: { id: 14 },
    label: {
      en: 'Russia (16° / 15°)',
      fr: 'Russie (16° / 15°)',
      de: 'Russland (16° / 15°)',
      es: 'Rusia (16° / 15°)',
    },
  },
  tehran: {
    fajr: 17.7,
    isha: { angle: 14 },
    maghrib: { angle: 4.5 },
    midnight: 'jafari',
    aladhan: { id: 7 },
    label: {
      en: 'University of Tehran (17.7° / 14°)',
      fr: 'Université de Téhéran (17,7° / 14°)',
      de: 'Universität Teheran (17,7° / 14°)',
      es: 'Universidad de Teherán (17,7° / 14°)',
    },
  },
  jafari: {
    fajr: 16,
    isha: { angle: 14 },
    maghrib: { angle: 4 },
    midnight: 'jafari',
    aladhan: { id: 0 },
    label: {
      en: 'Shia Ithna Ashari, Qum (16° / 14°)',
      fr: 'Chiite duodécimain, Qom (16° / 14°)',
      de: 'Schiitisch, Ghom (16° / 14°)',
      es: 'Chiita duodecimano, Qom (16° / 14°)',
    },
  },
};

// The user-defined method: angles from the configuration (see methodFromConfig).
export const CUSTOM_METHOD = 'custom';

export const CUSTOM_LABEL = {
  en: 'Custom angles',
  fr: 'Angles personnalisés',
  de: 'Eigene Winkel',
  es: 'Ángulos personalizados',
};

export const METHOD_KEYS = [...Object.keys(METHODS), CUSTOM_METHOD];

/**
 * The method the configuration selects, the custom one built from its angles.
 * @param {object} config normalized configuration
 * @returns {Method}
 */
export function methodFromConfig(config) {
  if (config.method !== CUSTOM_METHOD) {
    return METHODS[config.method] ?? METHODS.mwl;
  }
  const isha =
    config.custom_isha_minutes > 0
      ? { minutes: config.custom_isha_minutes }
      : { angle: config.custom_isha_angle };
  const ishaSetting = isha.minutes !== undefined ? `${isha.minutes} min` : String(isha.angle);
  return {
    fajr: config.custom_fajr_angle,
    isha,
    midnight: 'standard',
    aladhan: { id: 99, settings: `${config.custom_fajr_angle},null,${ishaSetting}` },
    label: CUSTOM_LABEL,
  };
}
