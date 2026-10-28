import { haversineDistance } from "./haversine";
import { bearingFrom } from "./mapGeometry";

export type Site = { latitude: number; longitude: number; radiusKm: number };
export type Aircraft = {
  id: string;
  callsign: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number;
  bearing: number;
  track: number | null;
  altitudeMeters: number | null;
  altitudeSource: "geometric" | "barometric" | null;
  category: string | null;
  observedAt: number;
};

export const POSITION_LIFETIME_MS = 30000;

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizeAircraft(payload: unknown, site: Site, receivedAt = Date.now()): Aircraft[] {
  if (!payload || typeof payload !== "object" || !("aircraft" in payload) || !Array.isArray(payload.aircraft)) {
    throw new Error("Invalid aircraft feed");
  }
  const sourceTime = "now" in payload && finiteNumber(payload.now) && payload.now > 1000000000
    ? Math.min(receivedAt, payload.now * 1000) : receivedAt;
  const aircraft = new Map<string, Aircraft>();
  for (const value of payload.aircraft) {
    if (!value || typeof value !== "object") continue;
    const { lat, lon, flight, hex, alt_baro, alt_geom, altitude, seen_pos, seen, track, category } = value;
    if (!finiteNumber(lat) || !finiteNumber(lon) || Math.abs(lat) > 85.05112878 || Math.abs(lon) > 180) continue;
    const callsign = typeof flight === "string" ? flight.trim() || null : null;
    const id = typeof hex === "string" && hex.trim() ? hex.trim().toLowerCase() : callsign;
    if (!id || alt_baro === "ground" || altitude === "ground") continue;
    const ageSeconds = finiteNumber(seen_pos) ? seen_pos : finiteNumber(seen) ? seen : 0;
    const observedAt = sourceTime - Math.max(0, ageSeconds) * 1000;
    if (receivedAt - observedAt > POSITION_LIFETIME_MS) continue;
    const distanceKm = haversineDistance(site.latitude, site.longitude, lat, lon);
    if (distanceKm > site.radiusKm) continue;
    const altitudeFeet = finiteNumber(alt_geom) ? alt_geom : finiteNumber(alt_baro) ? alt_baro : finiteNumber(altitude) ? altitude : null;
    const plane: Aircraft = {
      id, callsign, latitude: lat, longitude: lon, distanceKm,
      bearing: bearingFrom(site.latitude, site.longitude, lat, lon),
      track: finiteNumber(track) ? ((track % 360) + 360) % 360 : null,
      altitudeMeters: altitudeFeet === null ? null : Math.round(altitudeFeet * 0.3048),
      altitudeSource: altitudeFeet === null ? null : finiteNumber(alt_geom) ? "geometric" : "barometric",
      category: typeof category === "string" ? category : null,
      observedAt,
    };
    const existing = aircraft.get(id);
    if (!existing || plane.observedAt > existing.observedAt) aircraft.set(id, plane);
  }
  return Array.from(aircraft.values()).sort((first, second) => first.distanceKm - second.distanceKm);
}

export function demoAircraft(site: Site, elapsedSeconds: number): Aircraft[] {
  const samples = [
    { hex: "demo01", flight: "DLH231", north: 0.72, east: -0.52, track: 125, alt_baro: 8100, category: "A3" },
    { hex: "demo02", flight: "KLM1784", north: -0.3, east: 0.62, track: 310, alt_baro: 11200, category: "A5" },
    { hex: "demo03", flight: "EWG904", north: -0.71, east: -0.46, track: 55, alt_baro: 6700, category: "A3" },
    { hex: "demo04", flight: "DHELI", north: 0.42, east: 0.33, track: 200, alt_baro: 1900, category: "A7" },
    { hex: "demo05", flight: null, north: -0.22, east: -0.17, track: 20, alt_baro: 4200, category: "A2" },
  ];
  return normalizeAircraft({ aircraft: samples.map((sample, index) => ({
    ...sample,
    lat: site.latitude + (sample.north + Math.sin(elapsedSeconds / 90 + index) * 0.08) * site.radiusKm / 111.32,
    lon: site.longitude + (sample.east + Math.cos(elapsedSeconds / 90 + index) * 0.08) * site.radiusKm / (111.32 * Math.cos(site.latitude * Math.PI / 180)),
  })) }, site);
}