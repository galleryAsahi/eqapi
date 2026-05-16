import assert from "node:assert/strict";
import { enrichEvent } from "./server.mjs";

const stationIndex = new Map([
  [
    "Station A",
    {
      code: "0000010",
      name: "Station A",
      pref: { name: "Pref A", code: 1, furigana: "pref-a" },
      city: { code: "0000100", name: "City A", furigana: "city-a" },
      area: { code: "001", name: "Area A", furigana: "area-a" },
    },
  ],
  [
    "Station B",
    {
      code: "0000020",
      name: "Station B",
      pref: { name: "Pref A", code: 1, furigana: "pref-a" },
      city: { code: "0000100", name: "City A", furigana: "city-a" },
      area: { code: "001", name: "Area A", furigana: "area-a" },
    },
  ],
]);

const areaIndex = new Map([
  [
    "Pref A\u0000Area A",
    {
      key: "001",
      code: "001",
      name: "Area A",
      pref: "Pref A",
    },
  ],
]);

const enriched = enrichEvent(
  {
    code: 551,
    points: [
      { addr: "Station A", pref: "Pref A", scale: 20 },
      { addr: "Station A", pref: "Pref A", scale: 30 },
      { addr: "Station B", pref: "Pref A", scale: 45 },
      { addr: "Unknown Station", pref: "Pref A", scale: 10 },
    ],
  },
  { stationIndex, areaIndex },
);

assert.equal(enriched.points, undefined);
assert.deepEqual(enriched.cityMaxIntensities[0], {
  code: "0000100",
  name: "City A",
  pref: "Pref A",
  scale: 45,
  key: "0000100",
});
assert.equal(enriched.areaMaxIntensities.length, 1);
assert.equal(enriched.areaMaxIntensities[0].scale, 45);
assert.equal(enriched.unmatchedPoints, undefined);

const intensityFlash = enrichEvent(
  {
    code: 551,
    issue: { type: "ScalePrompt" },
    points: [
      { addr: "Area A", pref: "Pref A", scale: 30 },
      { addr: "Area A", pref: "Pref A", scale: 40 },
    ],
  },
  { stationIndex, areaIndex },
);

assert.equal(intensityFlash.cityMaxIntensities.length, 0);
assert.deepEqual(intensityFlash.areaMaxIntensities[0], {
  code: "001",
  name: "Area A",
  pref: "Pref A",
  scale: 40,
  key: "001",
});

console.log("ok");
