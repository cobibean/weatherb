export type TestCity = {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
};

/**
 * List of 100 real cities worldwide for testing weather provider accuracy.
 * Includes diverse geographic distribution across all continents and various climates.
 */
export const TEST_CITIES: readonly TestCity[] = [
  // North America - United States
  { name: 'New York', latitude: 40.7128, longitude: -74.006, country: 'United States' },
  { name: 'Los Angeles', latitude: 34.0522, longitude: -118.2437, country: 'United States' },
  { name: 'Chicago', latitude: 41.8781, longitude: -87.6298, country: 'United States' },
  { name: 'Houston', latitude: 29.7604, longitude: -95.3698, country: 'United States' },
  { name: 'Phoenix', latitude: 33.4484, longitude: -112.074, country: 'United States' },
  { name: 'Philadelphia', latitude: 39.9526, longitude: -75.1652, country: 'United States' },
  { name: 'San Antonio', latitude: 29.4241, longitude: -98.4936, country: 'United States' },
  { name: 'San Diego', latitude: 32.7157, longitude: -117.1611, country: 'United States' },
  { name: 'Dallas', latitude: 32.7767, longitude: -96.797, country: 'United States' },
  { name: 'San Jose', latitude: 37.3382, longitude: -121.8863, country: 'United States' },
  { name: 'Miami', latitude: 25.7617, longitude: -80.1918, country: 'United States' },
  { name: 'Seattle', latitude: 47.6062, longitude: -122.3321, country: 'United States' },
  { name: 'Boston', latitude: 42.3601, longitude: -71.0589, country: 'United States' },
  { name: 'Denver', latitude: 39.7392, longitude: -104.9903, country: 'United States' },
  { name: 'Portland', latitude: 45.5152, longitude: -122.6784, country: 'United States' },
  
  // North America - Canada
  { name: 'Toronto', latitude: 43.6532, longitude: -79.3832, country: 'Canada' },
  { name: 'Vancouver', latitude: 49.2827, longitude: -123.1207, country: 'Canada' },
  { name: 'Montreal', latitude: 45.5017, longitude: -73.5673, country: 'Canada' },
  { name: 'Calgary', latitude: 51.0447, longitude: -114.0719, country: 'Canada' },
  { name: 'Ottawa', latitude: 45.4215, longitude: -75.6972, country: 'Canada' },
  
  // North America - Mexico
  { name: 'Mexico City', latitude: 19.4326, longitude: -99.1332, country: 'Mexico' },
  { name: 'Guadalajara', latitude: 20.6597, longitude: -103.3496, country: 'Mexico' },
  { name: 'Monterrey', latitude: 25.6866, longitude: -100.3161, country: 'Mexico' },
  
  // South America
  { name: 'São Paulo', latitude: -23.5505, longitude: -46.6333, country: 'Brazil' },
  { name: 'Rio de Janeiro', latitude: -22.9068, longitude: -43.1729, country: 'Brazil' },
  { name: 'Buenos Aires', latitude: -34.6037, longitude: -58.3816, country: 'Argentina' },
  { name: 'Lima', latitude: -12.0464, longitude: -77.0428, country: 'Peru' },
  { name: 'Bogotá', latitude: 4.711, longitude: -74.0721, country: 'Colombia' },
  { name: 'Santiago', latitude: -33.4489, longitude: -70.6693, country: 'Chile' },
  { name: 'Caracas', latitude: 10.4806, longitude: -66.9036, country: 'Venezuela' },
  { name: 'Quito', latitude: -0.1807, longitude: -78.4678, country: 'Ecuador' },
  
  // Europe - Western
  { name: 'London', latitude: 51.5074, longitude: -0.1278, country: 'United Kingdom' },
  { name: 'Paris', latitude: 48.8566, longitude: 2.3522, country: 'France' },
  { name: 'Berlin', latitude: 52.52, longitude: 13.405, country: 'Germany' },
  { name: 'Madrid', latitude: 40.4168, longitude: -3.7038, country: 'Spain' },
  { name: 'Rome', latitude: 41.9028, longitude: 12.4964, country: 'Italy' },
  { name: 'Amsterdam', latitude: 52.3676, longitude: 4.9041, country: 'Netherlands' },
  { name: 'Brussels', latitude: 50.8503, longitude: 4.3517, country: 'Belgium' },
  { name: 'Vienna', latitude: 48.2082, longitude: 16.3738, country: 'Austria' },
  { name: 'Zurich', latitude: 47.3769, longitude: 8.5417, country: 'Switzerland' },
  { name: 'Dublin', latitude: 53.3498, longitude: -6.2603, country: 'Ireland' },
  { name: 'Lisbon', latitude: 38.7223, longitude: -9.1393, country: 'Portugal' },
  { name: 'Stockholm', latitude: 59.3293, longitude: 18.0686, country: 'Sweden' },
  { name: 'Oslo', latitude: 59.9139, longitude: 10.7522, country: 'Norway' },
  { name: 'Copenhagen', latitude: 55.6761, longitude: 12.5683, country: 'Denmark' },
  { name: 'Helsinki', latitude: 60.1699, longitude: 24.9384, country: 'Finland' },
  
  // Europe - Eastern
  { name: 'Moscow', latitude: 55.7558, longitude: 37.6173, country: 'Russia' },
  { name: 'Warsaw', latitude: 52.2297, longitude: 21.0122, country: 'Poland' },
  { name: 'Prague', latitude: 50.0755, longitude: 14.4378, country: 'Czech Republic' },
  { name: 'Budapest', latitude: 47.4979, longitude: 19.0402, country: 'Hungary' },
  { name: 'Bucharest', latitude: 44.4268, longitude: 26.1025, country: 'Romania' },
  { name: 'Athens', latitude: 37.9838, longitude: 23.7275, country: 'Greece' },
  { name: 'Istanbul', latitude: 41.0082, longitude: 28.9784, country: 'Turkey' },
  
  // Asia - East
  { name: 'Tokyo', latitude: 35.6762, longitude: 139.6503, country: 'Japan' },
  { name: 'Beijing', latitude: 39.9042, longitude: 116.4074, country: 'China' },
  { name: 'Shanghai', latitude: 31.2304, longitude: 121.4737, country: 'China' },
  { name: 'Seoul', latitude: 37.5665, longitude: 126.978, country: 'South Korea' },
  { name: 'Hong Kong', latitude: 22.3193, longitude: 114.1694, country: 'Hong Kong' },
  { name: 'Taipei', latitude: 25.033, longitude: 121.5654, country: 'Taiwan' },
  { name: 'Bangkok', latitude: 13.7563, longitude: 100.5018, country: 'Thailand' },
  { name: 'Singapore', latitude: 1.3521, longitude: 103.8198, country: 'Singapore' },
  { name: 'Manila', latitude: 14.5995, longitude: 120.9842, country: 'Philippines' },
  { name: 'Jakarta', latitude: -6.2088, longitude: 106.8456, country: 'Indonesia' },
  { name: 'Kuala Lumpur', latitude: 3.139, longitude: 101.6869, country: 'Malaysia' },
  { name: 'Ho Chi Minh City', latitude: 10.8231, longitude: 106.6297, country: 'Vietnam' },
  
  // Asia - South
  { name: 'Mumbai', latitude: 19.076, longitude: 72.8777, country: 'India' },
  { name: 'Delhi', latitude: 28.6139, longitude: 77.209, country: 'India' },
  { name: 'Bangalore', latitude: 12.9716, longitude: 77.5946, country: 'India' },
  { name: 'Karachi', latitude: 24.8607, longitude: 67.0011, country: 'Pakistan' },
  { name: 'Dhaka', latitude: 23.8103, longitude: 90.4125, country: 'Bangladesh' },
  { name: 'Colombo', latitude: 6.9271, longitude: 79.8612, country: 'Sri Lanka' },
  
  // Asia - Middle East
  { name: 'Dubai', latitude: 25.2048, longitude: 55.2708, country: 'United Arab Emirates' },
  { name: 'Riyadh', latitude: 24.7136, longitude: 46.6753, country: 'Saudi Arabia' },
  { name: 'Tel Aviv', latitude: 32.0853, longitude: 34.7818, country: 'Israel' },
  { name: 'Tehran', latitude: 35.6892, longitude: 51.389, country: 'Iran' },
  { name: 'Baghdad', latitude: 33.3152, longitude: 44.3661, country: 'Iraq' },
  
  // Africa
  { name: 'Cairo', latitude: 30.0444, longitude: 31.2357, country: 'Egypt' },
  { name: 'Lagos', latitude: 6.5244, longitude: 3.3792, country: 'Nigeria' },
  { name: 'Johannesburg', latitude: -26.2041, longitude: 28.0473, country: 'South Africa' },
  { name: 'Nairobi', latitude: -1.2921, longitude: 36.8219, country: 'Kenya' },
  { name: 'Casablanca', latitude: 33.5731, longitude: -7.5898, country: 'Morocco' },
  { name: 'Addis Ababa', latitude: 9.145, longitude: 38.7667, country: 'Ethiopia' },
  { name: 'Accra', latitude: 5.6037, longitude: -0.187, country: 'Ghana' },
  { name: 'Dar es Salaam', latitude: -6.7924, longitude: 39.2083, country: 'Tanzania' },
  
  // Oceania
  { name: 'Sydney', latitude: -33.8688, longitude: 151.2093, country: 'Australia' },
  { name: 'Melbourne', latitude: -37.8136, longitude: 144.9631, country: 'Australia' },
  { name: 'Brisbane', latitude: -27.4698, longitude: 153.0251, country: 'Australia' },
  { name: 'Perth', latitude: -31.9505, longitude: 115.8605, country: 'Australia' },
  { name: 'Auckland', latitude: -36.8485, longitude: 174.7633, country: 'New Zealand' },
  { name: 'Wellington', latitude: -41.2865, longitude: 174.7762, country: 'New Zealand' },
  
  // Additional diverse locations
  { name: 'Reykjavik', latitude: 64.1466, longitude: -21.9426, country: 'Iceland' },
  { name: 'Anchorage', latitude: 61.2181, longitude: -149.9003, country: 'United States' },
  { name: 'Honolulu', latitude: 21.3099, longitude: -157.8581, country: 'United States' },
  { name: 'Fairbanks', latitude: 64.8378, longitude: -147.7164, country: 'United States' },
] as const;
