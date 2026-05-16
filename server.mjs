import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DEFAULT_SOURCE_URL = "https://api.p2pquake.net/v2/history?codes=551&limit=1";
const PORT = Number(process.env.PORT || 3000);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIONS_PATH = path.join(
  __dirname,
  "79005d1896631ad6117bbe327b8162c1-6458684e522767a9ffc42f9bba9d6b2b06253f44",
  "stations.json",
);

let stationIndexesPromise;

function areaLookupKey(pref, areaName) {
  return `${pref || ""}\u0000${areaName}`;
}

async function loadStationIndexes() {
  if (!stationIndexesPromise) {
    stationIndexesPromise = readFile(STATIONS_PATH, "utf8").then((content) => {
      const stations = JSON.parse(content);
      const stationIndex = new Map();
      const areaIndex = new Map();

      for (const station of stations) {
        stationIndex.set(station.name, station);

        const area = {
          key: station.area.code,
          code: station.area.code,
          name: station.area.name,
          pref: station.pref.name,
        };

        areaIndex.set(areaLookupKey(station.pref.name, station.area.name), area);

        if (!areaIndex.has(areaLookupKey("", station.area.name))) {
          areaIndex.set(areaLookupKey("", station.area.name), area);
        }
      }

      return { stationIndex, areaIndex };
    });
  }

  return stationIndexesPromise;
}

function keepMaxScale(current, candidate) {
  if (!current || candidate.scale > current.scale) {
    return candidate;
  }

  return current;
}

function toIntensityRecord({ key, name, code, pref, scale }) {
  return {
    code,
    name,
    pref,
    scale,
    key,
  };
}

function sortedIntensities(records) {
  return [...records.values()]
    .map(toIntensityRecord)
    .sort((a, b) => b.scale - a.scale || a.key.localeCompare(b.key, "ja"));
}

export function summarizeEvent(event, stationIndexes) {
  const stationIndex = stationIndexes.stationIndex || stationIndexes;
  const areaIndex = stationIndexes.areaIndex || new Map();
  const cityMax = new Map();
  const areaMax = new Map();

  for (const point of event.points || []) {
    const station = stationIndex.get(point.addr);

    if (!station) {
      const area =
        areaIndex.get(areaLookupKey(point.pref, point.addr)) ||
        areaIndex.get(areaLookupKey("", point.addr));

      if (area) {
        const areaAsCity = {
          ...area,
          key: `area:${area.key}`,
        };
        cityMax.set(
          areaAsCity.key,
          keepMaxScale(cityMax.get(areaAsCity.key), {
            ...areaAsCity,
            scale: point.scale,
          }),
        );
        areaMax.set(
          area.key,
          keepMaxScale(areaMax.get(area.key), {
            ...area,
            scale: point.scale,
          }),
        );
      }

      continue;
    }

    const cityKey = station.city.code;
    cityMax.set(
      cityKey,
      keepMaxScale(cityMax.get(cityKey), {
        key: cityKey,
        code: station.city.code,
        name: station.city.name,
        pref: station.pref.name,
        scale: point.scale,
      }),
    );

    const areaKey = station.area.code;
    areaMax.set(
      areaKey,
      keepMaxScale(areaMax.get(areaKey), {
        key: areaKey,
        code: station.area.code,
        name: station.area.name,
        pref: station.pref.name,
        scale: point.scale,
      }),
    );
  }

  const { points, ...eventWithoutPoints } = event;

  return {
    event: eventWithoutPoints,
    cityInt: sortedIntensities(cityMax),
    areaInt: sortedIntensities(areaMax),
  };
}

export const enrichEvent = summarizeEvent;

function publicResponse(summary) {
  return {
    sourse: "p2pquake",
    instisourse: "気象庁",
    generatedAt: new Date().toISOString(),
    event: summary.event,
    cityInt: summary.cityInt,
    areaInt: summary.areaInt,
  };
}

export async function buildResponse(sourceUrl = DEFAULT_SOURCE_URL) {
  const stationIndexes = await loadStationIndexes();
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "p2pquake-intensity-api/1.0",
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`P2PQuake returned ${response.status}`);
  }

  const payload = await response.json();
  const event = Array.isArray(payload) ? payload[0] : payload;
  const summary = summarizeEvent(event || {}, stationIndexes);

  return publicResponse(summary);
}

function sendJson(res, statusCode, body) {
  const json = JSON.stringify(body, null, 2);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(json);
}

async function intensityResponse(sourceUrl, pick) {
  const response = await buildResponse(sourceUrl);
  if (pick === "cities") {
    return {
      sourse: response.sourse,
      instisourse: response.instisourse,
      generatedAt: response.generatedAt,
      event: response.event,
      cityInt: response.cityInt,
    };
  }

  if (pick === "areas") {
    return {
      sourse: response.sourse,
      instisourse: response.instisourse,
      generatedAt: response.generatedAt,
      event: response.event,
      areaInt: response.areaInt,
    };
  }

  return response;
}

export function createApiServer() {
  return createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        sendJson(res, 204, {});
        return;
      }

      const requestUrl = new URL(req.url, `http://${req.headers.host}`);

      if (req.method === "GET" && requestUrl.pathname === "/health") {
        sendJson(res, 200, { ok: true });
        return;
      }

      if (req.method === "GET" && requestUrl.pathname === "/api/intensities") {
        const sourceUrl = requestUrl.searchParams.get("source") || DEFAULT_SOURCE_URL;
        sendJson(res, 200, await intensityResponse(sourceUrl));
        return;
      }

      if (req.method === "GET" && requestUrl.pathname === "/api/city-intensities") {
        const sourceUrl = requestUrl.searchParams.get("source") || DEFAULT_SOURCE_URL;
        sendJson(res, 200, await intensityResponse(sourceUrl, "cities"));
        return;
      }

      if (req.method === "GET" && requestUrl.pathname === "/api/area-intensities") {
        const sourceUrl = requestUrl.searchParams.get("source") || DEFAULT_SOURCE_URL;
        sendJson(res, 200, await intensityResponse(sourceUrl, "areas"));
        return;
      }

      sendJson(res, 404, {
        error: "not_found",
        message: "GET /api/intensities を利用してください。",
      });
    } catch (error) {
      sendJson(res, 500, {
        error: "internal_error",
        message: error.message,
      });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  createApiServer().listen(PORT, () => {
    console.log(`API server listening on http://localhost:${PORT}`);
  });
}
