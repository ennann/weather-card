import citiesData from '../data/cities.json';
import slugMap from '../data/city-slugs.json';

export function pickRandomCity(): string {
  const cities = citiesData.cities;
  return cities[Math.floor(Math.random() * cities.length)];
}

export function getCitySlug(city: string): string {
  // Exact match
  if (slugMap[city as keyof typeof slugMap]) {
    return slugMap[city as keyof typeof slugMap];
  }
  // Try with 市 suffix
  const withSuffix = city + '市';
  if (slugMap[withSuffix as keyof typeof slugMap]) {
    return slugMap[withSuffix as keyof typeof slugMap];
  }
  // Fallback: lowercase, remove non-alphanumeric
  return city.toLowerCase().replace(/[^a-z0-9]/g, '') || 'unknown';
}
