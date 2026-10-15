// -----------------------------------------------------------------------------
// Where the times are computed for.
//
// By default, the house of Gladys: the manifest declares `location: true`, so
// the container may read the houses and their coordinates (GET /house, shown
// to the user on the install screen). The user may pick one house (a
// `source: "houses"` select storing its selector) or type coordinates, which
// win. The coordinates are personal data: never logged.
// -----------------------------------------------------------------------------

/**
 * @param {object} config normalized configuration
 * @param {Array<{ name: string, selector: string, latitude: number|null, longitude: number|null }>} houses
 * @returns {{ latitude: number, longitude: number, source: 'config'|'house', houseName?: string } | null}
 */
export function resolveLocation(config, houses) {
  if (config.latitude !== null && config.longitude !== null) {
    return { latitude: config.latitude, longitude: config.longitude, source: 'config' };
  }
  const located = (house) => Number.isFinite(house?.latitude) && Number.isFinite(house?.longitude);
  const house = config.house
    ? houses.find((candidate) => candidate.selector === config.house)
    : houses.find(located);
  if (!located(house)) {
    return null;
  }
  return {
    latitude: house.latitude,
    longitude: house.longitude,
    source: 'house',
    houseName: house.name,
  };
}

/** Two locations give the same times. */
export function sameLocation(a, b) {
  return a?.latitude === b?.latitude && a?.longitude === b?.longitude;
}
