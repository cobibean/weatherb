export type City = {
  slug: string; // Stable identifier for on-chain hashing (e.g., "nyc", "austin")
  name: string;
  latitude: number;
  longitude: number;
  countryCode?: string;
  timezone?: string;
};

export const CITIES: readonly City[] = [
  {
    slug: 'nyc',
    name: 'New York City',
    latitude: 40.7128,
    longitude: -74.006,
    countryCode: 'US',
    timezone: 'America/New_York',
  },
  {
    slug: 'la',
    name: 'Los Angeles',
    latitude: 34.0522,
    longitude: -118.2437,
    countryCode: 'US',
    timezone: 'America/Los_Angeles',
  },
  {
    slug: 'chi',
    name: 'Chicago',
    latitude: 41.8781,
    longitude: -87.6298,
    countryCode: 'US',
    timezone: 'America/Chicago',
  },
  {
    slug: 'miami',
    name: 'Miami',
    latitude: 25.7617,
    longitude: -80.1918,
    countryCode: 'US',
    timezone: 'America/New_York',
  },
  {
    slug: 'seattle',
    name: 'Seattle',
    latitude: 47.6062,
    longitude: -122.3321,
    countryCode: 'US',
    timezone: 'America/Los_Angeles',
  },
  {
    slug: 'denver',
    name: 'Denver',
    latitude: 39.7392,
    longitude: -104.9903,
    countryCode: 'US',
    timezone: 'America/Denver',
  },
  {
    slug: 'phoenix',
    name: 'Phoenix',
    latitude: 33.4484,
    longitude: -112.074,
    countryCode: 'US',
    timezone: 'America/Phoenix',
  },
  {
    slug: 'austin',
    name: 'Austin',
    latitude: 30.2672,
    longitude: -97.7431,
    countryCode: 'US',
    timezone: 'America/Chicago',
  },
];
