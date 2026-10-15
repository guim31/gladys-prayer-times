// -----------------------------------------------------------------------------
// Every text the container produces, in the four languages of the Gladys
// interface. German says "du", Spanish "usted" (test/i18n.test.js checks it).
// The prayer names are the usual transliterations, the same in every language.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';

/** Names of the times, by language then key. */
export const TIME_NAMES = {
  en: {
    imsak: 'Imsak',
    fajr: 'Fajr',
    sunrise: 'Sunrise',
    dhuhr: 'Dhuhr',
    asr: 'Asr',
    maghrib: 'Maghrib',
    isha: 'Isha',
    midnight: 'Midnight',
  },
  fr: {
    imsak: 'Imsak',
    fajr: 'Fajr',
    sunrise: 'Lever du soleil',
    dhuhr: 'Dhuhr',
    asr: 'Asr',
    maghrib: 'Maghrib',
    isha: 'Isha',
    midnight: 'Minuit',
  },
  de: {
    imsak: 'Imsak',
    fajr: 'Fajr',
    sunrise: 'Sonnenaufgang',
    dhuhr: 'Dhuhr',
    asr: 'Asr',
    maghrib: 'Maghrib',
    isha: 'Isha',
    midnight: 'Mitternacht',
  },
  es: {
    imsak: 'Imsak',
    fajr: 'Fajr',
    sunrise: 'Salida del sol',
    dhuhr: 'Dhuhr',
    asr: 'Asr',
    maghrib: 'Maghrib',
    isha: 'Isha',
    midnight: 'Medianoche',
  },
};

/** Names of the device and of its features that are not a time of the day. */
export const DEVICE_NAMES = {
  en: {
    device: 'Prayer times',
    next_prayer: 'Next prayer',
    next_prayer_time: 'Next prayer time',
    minutes_to_next: 'Time to next prayer',
  },
  fr: {
    device: 'Horaires de prière',
    next_prayer: 'Prochaine prière',
    next_prayer_time: 'Heure de la prochaine prière',
    minutes_to_next: 'Temps avant la prochaine prière',
  },
  de: {
    device: 'Gebetszeiten',
    next_prayer: 'Nächstes Gebet',
    next_prayer_time: 'Uhrzeit des nächsten Gebets',
    minutes_to_next: 'Zeit bis zum nächsten Gebet',
  },
  es: {
    device: 'Horarios de oración',
    next_prayer: 'Próxima oración',
    next_prayer_time: 'Hora de la próxima oración',
    minutes_to_next: 'Tiempo hasta la próxima oración',
  },
};

/** Messages shown in Gladys (connection status, action results, errors). */
export const MESSAGES = {
  noLocation: {
    en: 'No location: give your house coordinates in Gladys (Settings → Houses), or type them in the configuration.',
    fr: 'Aucune position : renseignez les coordonnées de votre maison dans Gladys (Paramètres → Maisons), ou saisissez-les dans la configuration.',
    de: 'Kein Standort: Gib die Koordinaten deines Hauses in Gladys ein (Einstellungen → Zuhause) oder trage sie in der Konfiguration ein.',
    es: 'Sin ubicación: indique las coordenadas de su vivienda en Gladys (Configuración → Viviendas) o escríbalas en la configuración.',
  },
  initFailed: {
    en: 'Initialization failed, check the integration logs.',
    fr: "L'initialisation a échoué, consultez les journaux de l'intégration.",
    de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
    es: 'La inicialización ha fallado, consulte los registros de la integración.',
  },
};

/** Words of the widget and of the "today's times" action. */
export const TEXT = {
  en: {
    next: (name, time) => `Next: ${name} at ${time}`,
    remaining: 'Time left',
    today: 'Today',
    house: 'House',
    coordinates: 'Typed coordinates',
    method: 'Method',
  },
  fr: {
    next: (name, time) => `Prochaine : ${name} à ${time}`,
    remaining: 'Temps restant',
    today: "Aujourd'hui",
    house: 'Maison',
    coordinates: 'Coordonnées saisies',
    method: 'Méthode',
  },
  de: {
    next: (name, time) => `Nächstes: ${name} um ${time}`,
    remaining: 'Verbleibend',
    today: 'Heute',
    house: 'Zuhause',
    coordinates: 'Eingegebene Koordinaten',
    method: 'Methode',
  },
  es: {
    next: (name, time) => `Próxima: ${name} a las ${time}`,
    remaining: 'Tiempo restante',
    today: 'Hoy',
    house: 'Vivienda',
    coordinates: 'Coordenadas introducidas',
    method: 'Método',
  },
};

/** The language to use: the requested one when Gladys knows it, else the fallback. */
export function pickLanguage(language, fallback = 'fr') {
  const short = typeof language === 'string' ? language.slice(0, 2).toLowerCase() : '';
  return LANGUAGES.includes(short) ? short : fallback;
}

/** "2 h 05" or "45 min": a duration short enough for a widget tile (12 characters). */
export function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${String(minutes % 60).padStart(2, '0')}`;
}

/** Build one multi-language object from a per-language table. */
export function allLanguages(render) {
  return Object.fromEntries(LANGUAGES.map((lang) => [lang, render(lang)]));
}
