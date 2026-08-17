// digipin.js
// DIGIPIN — the Digital Postal Index Number published by the Department of
// Posts (India) with IIT Hyderabad and ISRO.
//
// It encodes a latitude/longitude into a 10-character code naming a roughly
// 3.8 m x 3.8 m square, written as XXX-XXX-XXXX. The whole point for this app is
// that it is *sayable*: a girl in a village with no street name can read ten
// characters down a phone line to a 108 dispatcher, who decodes them back to a
// pin on a map. "Near the third house past the temple" cannot be dispatched to.
//
// The algorithm is deterministic and offline — no API key, no network call, and
// no location data leaving the device to compute it. That last property is why
// this is done client-side: the coordinates of a girl seeking reproductive
// health advice must not be posted to a server that has no need for them.
//
// Grid and bounds follow the published DIGIPIN specification.

const DIGIPIN_GRID = [
  ["F", "C", "9", "8"],
  ["J", "3", "2", "7"],
  ["K", "4", "5", "6"],
  ["L", "M", "P", "T"],
];

// The bounding box covers India's territorial extent, including the EEZ.
export const DIGIPIN_BOUNDS = {
  minLat: 2.5,
  maxLat: 38.5,
  minLon: 63.5,
  maxLon: 99.5,
};

const LEVELS = 10;

export function isWithinDigipinBounds(lat, lon) {
  return (
    lat >= DIGIPIN_BOUNDS.minLat && lat <= DIGIPIN_BOUNDS.maxLat &&
    lon >= DIGIPIN_BOUNDS.minLon && lon <= DIGIPIN_BOUNDS.maxLon
  );
}

/**
 * Encodes coordinates into a DIGIPIN.
 *
 * Each level subdivides the current cell into a 4x4 grid and appends the symbol
 * for the sub-cell containing the point. Rows run north to south, which is why
 * the row index is subtracted from 3 rather than used directly.
 *
 * @returns {string} e.g. "39J-49L-L8T4"
 */
export function encodeDigipin(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("Coordinates are not valid numbers.");
  }
  if (!isWithinDigipinBounds(lat, lon)) {
    throw new Error("This location is outside the area DIGIPIN covers.");
  }

  let minLat = DIGIPIN_BOUNDS.minLat;
  let maxLat = DIGIPIN_BOUNDS.maxLat;
  let minLon = DIGIPIN_BOUNDS.minLon;
  let maxLon = DIGIPIN_BOUNDS.maxLon;
  let out = "";

  for (let level = 1; level <= LEVELS; level++) {
    const latDiv = (maxLat - minLat) / 4;
    const lonDiv = (maxLon - minLon) / 4;

    // Clamped because a point exactly on the northern or eastern edge would
    // otherwise index one past the grid.
    let row = 3 - Math.floor((lat - minLat) / latDiv);
    let col = Math.floor((lon - minLon) / lonDiv);
    row = Math.max(0, Math.min(3, row));
    col = Math.max(0, Math.min(3, col));

    out += DIGIPIN_GRID[row][col];
    // Hyphens after the 3rd and 6th characters — the published grouping, and
    // the reason the code can be read aloud without losing your place.
    if (level === 3 || level === 6) out += "-";

    // Narrow the box to the chosen cell. Both new latitude bounds derive from
    // the OLD minLat, so they must be computed before either is reassigned.
    const nextMaxLat = minLat + latDiv * (4 - row);
    const nextMinLat = minLat + latDiv * (3 - row);
    maxLat = nextMaxLat;
    minLat = nextMinLat;

    const nextMinLon = minLon + lonDiv * col;
    minLon = nextMinLon;
    maxLon = nextMinLon + lonDiv;
  }

  return out;
}

/**
 * Decodes a DIGIPIN back to the centre of the square it names.
 * Accepts the code with or without hyphens, in any case.
 */
export function decodeDigipin(code) {
  const pin = String(code || "").replace(/-/g, "").trim().toUpperCase();
  if (pin.length !== LEVELS) {
    throw new Error("A DIGIPIN has 10 characters.");
  }

  let minLat = DIGIPIN_BOUNDS.minLat;
  let maxLat = DIGIPIN_BOUNDS.maxLat;
  let minLon = DIGIPIN_BOUNDS.minLon;
  let maxLon = DIGIPIN_BOUNDS.maxLon;

  for (const char of pin) {
    let row = -1;
    let col = -1;
    for (let r = 0; r < 4 && row === -1; r++) {
      for (let c = 0; c < 4; c++) {
        if (DIGIPIN_GRID[r][c] === char) { row = r; col = c; break; }
      }
    }
    if (row === -1) throw new Error(`"${char}" is not a DIGIPIN character.`);

    const latDiv = (maxLat - minLat) / 4;
    const lonDiv = (maxLon - minLon) / 4;

    const nextMaxLat = maxLat - latDiv * row;
    const nextMinLat = maxLat - latDiv * (row + 1);
    const nextMinLon = minLon + lonDiv * col;
    const nextMaxLon = minLon + lonDiv * (col + 1);

    minLat = nextMinLat; maxLat = nextMaxLat;
    minLon = nextMinLon; maxLon = nextMaxLon;
  }

  return {
    lat: (minLat + maxLat) / 2,
    lon: (minLon + maxLon) / 2,
    // The cell is ~3.8 m on a side at level 10; callers show this so nobody
    // mistakes a DIGIPIN for a GPS-exact fix.
    precisionMetres: Math.round((maxLat - minLat) * 111_320),
  };
}

export function formatDigipin(code) {
  const pin = String(code || "").replace(/-/g, "").toUpperCase();
  if (pin.length !== LEVELS) return code;
  return `${pin.slice(0, 3)}-${pin.slice(3, 6)}-${pin.slice(6)}`;
}

// The helpline directory used to live here, next to the location code, because
// the two are dialled together. It has since outgrown three numbers and moved to
// helplines.js — see that file for 108/102/112 and the sixteen other national
// lines, grouped by what has actually happened to the person calling.

/**
 * Builds the message to read out or send to a dispatcher.
 *
 * DIGIPIN first because it is the part a dispatcher can act on immediately;
 * raw coordinates second as a fallback for services that do not yet decode it;
 * a maps link last, for anyone reading it on a phone.
 */
export function buildLocationMessage({ digipin, lat, lon, placeName, note }) {
  const lines = [];
  if (note) lines.push(note);
  lines.push(`DIGIPIN: ${digipin}`);
  lines.push(`Coordinates: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
  if (placeName) lines.push(`Area: ${placeName}`);
  lines.push(`Map: https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`);
  return lines.join("\n");
}
