export type MapBounds = { west: number; south: number; east: number; north: number };

const EARTH_RADIUS = 6378137;

export function mercatorLatitude(latitude: number) {
  const limited = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  return Math.log(Math.tan(Math.PI / 4 + (limited * Math.PI) / 360));
}

export function createMapBounds(latitude: number, longitude: number, radiusKm: number, aspect: number): MapBounds {
  const halfHeight = radiusKm * 1000 * 1.28 / Math.cos(latitude * Math.PI / 180);
  const halfWidth = halfHeight * aspect;
  const centerNorth = mercatorLatitude(latitude) * EARTH_RADIUS;
  const inverse = (meters: number) => (2 * Math.atan(Math.exp(meters / EARTH_RADIUS)) - Math.PI / 2) * 180 / Math.PI;
  return {
    west: longitude - halfWidth / EARTH_RADIUS * 180 / Math.PI,
    east: longitude + halfWidth / EARTH_RADIUS * 180 / Math.PI,
    south: inverse(centerNorth - halfHeight),
    north: inverse(centerNorth + halfHeight),
  };
}

export function projectPosition(latitude: number, longitude: number, bounds: MapBounds) {
  return {
    x: (longitude - bounds.west) / (bounds.east - bounds.west),
    y: (mercatorLatitude(bounds.north) - mercatorLatitude(latitude)) /
      (mercatorLatitude(bounds.north) - mercatorLatitude(bounds.south)),
  };
}

export function bearingFrom(latitude: number, longitude: number, targetLatitude: number, targetLongitude: number) {
  const radians = Math.PI / 180;
  const delta = (targetLongitude - longitude) * radians;
  const east = Math.sin(delta) * Math.cos(targetLatitude * radians);
  const north = Math.cos(latitude * radians) * Math.sin(targetLatitude * radians) -
    Math.sin(latitude * radians) * Math.cos(targetLatitude * radians) * Math.cos(delta);
  return (Math.atan2(east, north) / radians + 360) % 360;
}

export function compassDirection(bearing: number) {
  return ["N", "NO", "O", "SO", "S", "SW", "W", "NW"][Math.round(bearing / 45) % 8];
}