// geo.js
// Browser geolocation + nearby-hospital lookup via OpenStreetMap's Overpass API.
// No API key required, which matters: the whole app is meant to run demoable
// with zero keys. If Overpass is slow/unreachable, we fall back to a plain
// Google Maps search link built from the same coordinates — still no key needed.

export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(new Error(
        "Location needs a secure connection. If you're testing on your phone via your computer's IP address, use 'localhost' on the computer itself, or set up HTTPS — browsers block location on plain http:// except localhost."
      ));
      return;
    }
    if (!navigator.geolocation) {
      reject(new Error("Location isn't available on this device or browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(new Error(err.message || "Couldn't get your location. Check location permissions.")),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000, ...options }
    );
  });
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function mapsSearchUrl(lat, lon) {
  return `https://www.google.com/maps/search/hospital/@${lat},${lon},14z`;
}

export function directionsUrl(lat, lon) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

/**
 * Best-effort human-readable area name for the given coordinates, via
 * OpenStreetMap's Nominatim. This is separate from the hospital lookup and
 * allowed to fail silently — it's a "you are here" nicety, not load-bearing.
 */
export async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    const place = a.suburb || a.village || a.town || a.city_district || a.city || a.county;
    const region = a.state;
    return [place, region].filter(Boolean).join(", ") || data.display_name || null;
  } catch {
    return null;
  }
}

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

function buildQuery(lat, lon, radiusMeters) {
  return `
    [out:json][timeout:20];
    (
      node["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
      way["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
      node["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
    );
    out center 25;
  `;
}

async function queryOverpassMirror(url, query, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      // Overpass's documented POST format: the query goes in a `data` field,
      // not as a raw body — sending it raw works on some mirrors but not all.
      body: "data=" + encodeURIComponent(query),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Mirror returned ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function parseElements(data, lat, lon) {
  return (data.elements || [])
    .map((el) => {
      const elLat = el.lat ?? el.center?.lat;
      const elLon = el.lon ?? el.center?.lon;
      if (!elLat || !elLon) return null;
      return {
        id: el.id,
        name: el.tags?.name || (el.tags?.amenity === "hospital" ? "Unnamed hospital" : "Unnamed clinic"),
        type: el.tags?.amenity,
        lat: elLat,
        lon: elLon,
        distanceKm: haversineKm(lat, lon, elLat, elLon),
        phone: el.tags?.phone || el.tags?.["contact:phone"] || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 8);
}

/**
 * Queries hospitals + clinics near (lat, lon). Tries each Overpass mirror in
 * turn (the public instances rate-limit / go down individually under load),
 * and if the first radius pass comes back empty, retries once at 20km before
 * giving up. Throws only if every mirror + both radii fail — caller should
 * catch and offer the mapsSearchUrl fallback.
 */
export async function fetchNearbyFacilities(lat, lon, radiusMeters = 8000) {
  let lastError = null;

  for (const radius of [radiusMeters, 20000]) {
    const query = buildQuery(lat, lon, radius);
    for (const mirror of OVERPASS_MIRRORS) {
      try {
        const data = await queryOverpassMirror(mirror, query);
        const facilities = parseElements(data, lat, lon);
        if (facilities.length > 0) return facilities;
        lastError = null; // a clean empty response isn't a failure, keep trying wider radius
      } catch (err) {
        lastError = err;
      }
    }
  }

  if (lastError) throw new Error("Couldn't reach any hospital data source — check your connection.");
  return []; // genuinely nothing found nearby even at 20km
}
