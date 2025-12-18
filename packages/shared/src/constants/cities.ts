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
];
