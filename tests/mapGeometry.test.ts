import assert from "node:assert/strict";
import { test } from "node:test";
import { bearingFrom, compassDirection, createMapBounds, projectPosition } from "../src/app/lib/mapGeometry";

test("map center, bounds and cardinal directions match the north-up image", () => {
  const bounds = createMapBounds(52.43657424314263, 10.595466532451821, 2, 1024 / 600);
  const center = projectPosition(52.43657424314263, 10.595466532451821, bounds);
  assert.ok(Math.abs(center.x - 0.5) < 1e-10);
  assert.ok(Math.abs(center.y - 0.5) < 1e-10);
  assert.deepEqual(projectPosition(bounds.north, bounds.west, bounds), { x: 0, y: 0 });
  assert.deepEqual(projectPosition(bounds.south, bounds.east, bounds), { x: 1, y: 1 });
  assert.ok(projectPosition(52.446, 10.595466532451821, bounds).y < center.y);
  assert.ok(projectPosition(52.43657424314263, 10.605, bounds).x > center.x);
});

test("bearings wrap correctly and describe all four directions", () => {
  assert.equal(bearingFrom(0, 0, 1, 0), 0);
  assert.equal(bearingFrom(0, 0, 0, 1), 90);
  assert.equal(bearingFrom(0, 0, -1, 0), 180);
  assert.equal(bearingFrom(0, 0, 0, -1), 270);
  assert.equal(compassDirection(359), "N");
  assert.equal(compassDirection(45), "NO");
});