import citiesData from '../../data/cities.json';

export function pickRandomCity(): string {
  const cities = citiesData.cities;
  return cities[Math.floor(Math.random() * cities.length)];
}
