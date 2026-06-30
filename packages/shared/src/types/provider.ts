export type WeatherReading = {
  tempF_tenths: number;
  observedTimestamp: number;
  source: string;
};

export type ProviderHealth = {
  status: 'green' | 'yellow' | 'red';
  latencyMs: number;
  lastCheck: number;
  errorMessage?: string;
};

export type WeatherProvider = {
  readonly name: string;
  getForecast(latitude: number, longitude: number, timestamp: number): Promise<number>;
  getFirstReadingAtOrAfter(
    latitude: number,
    longitude: number,
    timestamp: number,
  ): Promise<WeatherReading>;
  healthCheck(): Promise<ProviderHealth>;
};
