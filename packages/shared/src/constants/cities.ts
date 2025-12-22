export type City = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  countryCode?: string;
};

export const CITIES: readonly City[] = [
  {
    id: 'nyc',
    name: 'New York City',
    latitude: 40.7128,
    longitude: -74.006,
    countryCode: 'US',
  },
  {
    id: 'la',
    name: 'Los Angeles',
    latitude: 34.0522,
    longitude: -118.2437,
    countryCode: 'US',
  },
  {
    id: 'chi',
    name: 'Chicago',
    latitude: 41.8781,
    longitude: -87.6298,
    countryCode: 'US',
  },
  {
    id: 'miami',
    name: 'Miami',
    latitude: 25.7617,
    longitude: -80.1918,
    countryCode: 'US',
  },
  {
    id: 'seattle',
    name: 'Seattle',
    latitude: 47.6062,
    longitude: -122.3321,
    countryCode: 'US',
  },
  {
    id: 'denver',
    name: 'Denver',
    latitude: 39.7392,
    longitude: -104.9903,
    countryCode: 'US',
  },
  {
    id: 'phoenix',
    name: 'Phoenix',
    latitude: 33.4484,
    longitude: -112.074,
    countryCode: 'US',
  },
  {
    id: 'austin',
    name: 'Austin',
    latitude: 30.2672,
    longitude: -97.7431,
    countryCode: 'US',
  },
];
