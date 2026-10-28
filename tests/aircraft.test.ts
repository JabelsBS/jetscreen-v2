import assert from "node:assert/strict";
import { test } from "node:test";
import { demoAircraft, normalizeAircraft } from "../src/app/lib/aircraft";
import { createMapBounds } from "../src/app/lib/mapGeometry";

const site = { latitude: 0, longitude: 0, radiusKm: 2 };
const bounds = createMapBounds(site.latitude, site.longitude, site.radiusKm, 1024 / 426);
const receivedAt = 1800000000000;

test("valid zero coordinates and missing callsigns stay visible, nearest first", () => {
  const result = normalizeAircraft({ aircraft: [
    { hex: "ab12", lat: 0.01, lon: 0, flight: " ABC12 ", alt_geom: 10000, track: -10 },
    { hex: "CD34", lat: 0, lon: 0, alt_baro: 3000 },
  ] }, site, bounds, receivedAt);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, "cd34");
  assert.equal(result[0].callsign, null);
  assert.equal(result[1].callsign, "ABC12");
  assert.equal(result[1].altitudeMeters, 3048);
  assert.equal(result[1].altitudeSource, "geometric");
  assert.equal(result[1].track, 350);
});

test("invalid, grounded, stale and out-of-range contacts are excluded", () => {
  const result = normalizeAircraft({ aircraft: [
    { hex: "one", lat: 0, lon: 0, seen_pos: 31 },
    { hex: "two", lat: 0, lon: 0, alt_baro: "ground" },
    { hex: "three", lat: 1, lon: 1 },
    { hex: "four", lat: "0", lon: 0 },
    { hex: "five", lat: NaN, lon: 0 },
    { lat: 0, lon: 0 },
  ] }, site, bounds, receivedAt);
  assert.deepEqual(result, []);
  assert.deepEqual(normalizeAircraft({ now: receivedAt / 1000 - 40, aircraft: [{ hex: "old", lat: 0, lon: 0 }] }, site, bounds, receivedAt), []);
});

test("duplicate contacts prefer the freshest position and unknown altitude stays unknown", () => {
  const result = normalizeAircraft({ aircraft: [
    { hex: "abcd", lat: 0, lon: 0, seen_pos: 10 },
    { hex: "abcd", lat: 0.001, lon: 0, seen_pos: 1 },
  ] }, site, bounds, receivedAt);
  assert.equal(result.length, 1);
  assert.equal(result[0].latitude, 0.001);
  assert.equal(result[0].altitudeMeters, null);
  assert.throws(() => normalizeAircraft({}, site, bounds, receivedAt));
});

test("aircraft are included throughout the map and excluded outside each edge", () => {
  const result = normalizeAircraft({ aircraft: [
    { hex: "east", lat: 0, lon: bounds.east * 0.99 },
    { hex: "west", lat: 0, lon: bounds.west * 0.99 },
    { hex: "corner", lat: bounds.north * 0.99, lon: bounds.east * 0.99 },
    { hex: "outside-east", lat: 0, lon: bounds.east * 1.01 },
    { hex: "outside-west", lat: 0, lon: bounds.west * 1.01 },
    { hex: "outside-north", lat: bounds.north * 1.01, lon: 0 },
    { hex: "outside-south", lat: bounds.south * 1.01, lon: 0 },
  ] }, site, bounds, receivedAt);
  assert.deepEqual(result.map(plane => plane.id).sort(), ["corner", "east", "west"]);
  assert.ok(result.every(plane => plane.distanceKm > site.radiusKm));
});

test("aircraft across the antimeridian remain on the visible map", () => {
  const datelineSite = { latitude: 0, longitude: 179.99, radiusKm: 30 };
  const datelineBounds = createMapBounds(datelineSite.latitude, datelineSite.longitude, datelineSite.radiusKm, 1024 / 426);
  const result = normalizeAircraft({ aircraft: [
    { hex: "visible", lat: 0, lon: -179.9 },
    { hex: "outside", lat: 0, lon: -178 },
  ] }, datelineSite, datelineBounds, receivedAt);
  assert.deepEqual(result.map(plane => plane.id), ["visible"]);
});

test("demo produces multiple visible contacts without network", () => {
  const demoSite = { latitude: 52.43657424314263, longitude: 10.595466532451821, radiusKm: 2 };
  const demoBounds = createMapBounds(demoSite.latitude, demoSite.longitude, demoSite.radiusKm, 1024 / 426);
  assert.equal(demoAircraft(demoSite, demoBounds, 0).length, 5);
});