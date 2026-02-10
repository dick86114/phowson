import { reverseGeocode } from '../lib/geocoding.mjs';
import { badRequest } from '../lib/http_errors.mjs';

export const registerGeocodeRoutes = (app) => {
  app.get('/geocode', {
    schema: {
      querystring: {
        type: 'object',
        required: ['lat', 'lng'],
        properties: {
          lat: { type: 'number' },
          lng: { type: 'number' },
        },
      },
    },
    handler: async (req) => {
      const { lat, lng } = req.query;
      if (lat == null || lng == null) {
        throw badRequest('MISSING_COORDS', 'Missing latitude or longitude');
      }

      const location = await reverseGeocode(lat, lng);
      return { location: location || '' };
    },
  });
};
