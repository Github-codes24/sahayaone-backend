import axios from 'axios';
import { envConfig } from '../config/env.config.js';
import { logger } from './logger.util.js';

// User-provided static Google Maps Geocoding API Key with env override support
const STATIC_GOOGLE_MAPS_KEY = 'AIzaSyDc5r82MahA9rhAXROP0kv7rf0ZzUKOFR4';

/**
 * Parses Google Maps address_components into structured location components
 */
function extractGoogleAddressComponents(components = []) {
  let city = '';
  let state = '';
  let pincode = '';
  let country = '';

  components.forEach((c) => {
    const types = c.types || [];
    if (types.includes('locality')) {
      city = c.long_name || c.short_name;
    } else if (!city && (types.includes('administrative_area_level_2') || types.includes('sublocality_level_1'))) {
      city = c.long_name || c.short_name;
    }

    if (types.includes('administrative_area_level_1')) {
      state = c.long_name || c.short_name;
    }

    if (types.includes('postal_code')) {
      pincode = c.long_name || c.short_name;
    }

    if (types.includes('country')) {
      country = c.long_name || c.short_name;
    }
  });

  return { city, state, pincode, country };
}

/**
 * Full reverse geocoding returning structured address, city, state, pincode
 * Primary: Google Maps API (Static + Env Config)
 * Fallback: OpenStreetMap Nominatim
 */
export const reverseGeocodeLocation = async (latitude, longitude) => {
  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    return { address: '', city: '', state: '', pincode: '', country: '' };
  }

  const latNum = Number(latitude);
  const lngNum = Number(longitude);

  if (isNaN(latNum) || isNaN(lngNum)) {
    return { address: '', city: '', state: '', pincode: '', country: '' };
  }

  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    envConfig?.googleMapsApiKey ||
    STATIC_GOOGLE_MAPS_KEY;

  if (apiKey) {
    try {
      const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latNum},${lngNum}&key=${apiKey}`;
      const res = await axios.get(googleUrl, { timeout: 6000 });

      if (res.data?.status === 'OK' && res.data?.results?.[0]) {
        const firstResult = res.data.results[0];
        const formattedAddress = firstResult.formatted_address || '';
        const parsed = extractGoogleAddressComponents(firstResult.address_components);

        logger.info(
          `GEOCODING UTIL: Google Maps reverse geocode success: "${formattedAddress}" [City: ${parsed.city}, State: ${parsed.state}, Pin: ${parsed.pincode}]`
        );

        return {
          address: formattedAddress,
          city: parsed.city || '',
          state: parsed.state || '',
          pincode: parsed.pincode || '',
          country: parsed.country || 'India'
        };
      } else if (res.data?.error_message) {
        logger.warn(`GEOCODING UTIL: Google Maps API returned error: ${res.data.error_message}`);
      }
    } catch (err) {
      logger.warn(`GEOCODING UTIL: Google Maps API call failed (${err.message}). Trying fallback.`);
    }
  }

  // Fallback: OpenStreetMap Nominatim API
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latNum}&lon=${lngNum}&zoom=18&addressdetails=1`;
    const res = await axios.get(osmUrl, {
      headers: { 'User-Agent': 'Sahayaone-ERP-Backend/1.0' },
      timeout: 5000
    });

    if (res.data) {
      const addr = res.data.address || {};
      const road = addr.road || addr.street || addr.pedestrian || addr.suburb || '';
      const area = addr.neighbourhood || addr.residential || addr.subdistrict || addr.district || '';
      const city = addr.city || addr.town || addr.village || addr.county || addr.city_district || '';
      const state = addr.state || '';
      const postcode = addr.postcode || '';

      const parts = [road, area, city, state, postcode].filter(Boolean);
      const cleanAddress = parts.length >= 2 ? parts.join(', ') : res.data.display_name || '';

      logger.info(`GEOCODING UTIL: OpenStreetMap Nominatim reverse geocode success: "${cleanAddress}"`);

      return {
        address: cleanAddress,
        city: city || '',
        state: state || '',
        pincode: postcode || '',
        country: addr.country || 'India'
      };
    }
  } catch (err) {
    logger.warn(`GEOCODING UTIL: OpenStreetMap reverse geocode fallback failed (${err.message}).`);
  }

  return { address: '', city: '', state: '', pincode: '', country: '' };
};

/**
 * Returns formatted street address string (backward-compatible)
 */
export const reverseGeocodeCoordinates = async (latitude, longitude) => {
  const loc = await reverseGeocodeLocation(latitude, longitude);
  return loc.address || '';
};
