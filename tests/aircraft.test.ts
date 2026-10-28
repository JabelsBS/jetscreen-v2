import assert from "node:assert/strict";
import { test } from "node:test";
import { demoAircraft, normalizeAircraft } from "../src/app/lib/aircraft";

const site = { latitude: 0, longitude: 0, radiusKm: 2 };
const receivedAt = 1800000000000;

test("valid zero coordinates and missing callsigns stay visible, nearest first", () => {
  const result = normalizeAircraft({ aircraft: [
    { hex: "ab12", lat: 0.01, lon: 0, flight: " ABC12 ", alt_geom: 10000, track: -10 },
    { hex: "CD34", lat: 0, lon: 0, alt_baro: 3000 },
  ] }, site, receivedAt);
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
  ] }, site, receivedAt);
  assert.deepEqual(result, []);
  assert.deepEqual(normalizeAircraft({ now: receivedAt / 1000 - 40, aircraft: [{ hex: "old", lat: 0, lon: 0 }] }, site, receivedAt), []);
});

test("duplicate contacts prefer the freshest position and unknown altitude stays unknown", () => {
  const result = normalizeAircraft({ aircraft: [
    { hex: "abcd", lat: 0, lon: 0, seen_pos: 10 },
    { hex: "abcd", lat: 0.001, lon: 0, seen_pos: 1 },
  ] }, site, receivedAt);
  assert.equal(result.length, 1);
  assert.equal(result[0].latitude, 0.001);
  assert.equal(result[0].altitudeMeters, null);
  assert.throws(() => normalizeAircraft({}, site, receivedAt));
});

test("demo produces multiple in-range contacts without network", () => {
  assert.equal(demoAircraft({ latitude: 52.43657424314263, longitude: 10.595466532451821, radiusKm: 2 }, 0).length, 5);
});