import type { WeatherInfo } from './weather';

export function buildPrompt(city: string, weather: WeatherInfo): string {
  const cityName = city;
  const dateText = weather.date;
  const tempRange = `${weather.tempMin}°C ~ ${weather.tempMax}°C`;

  return `
Present a clear, 45° top-down view of a vertical (9:16) isometric miniature 3D cartoon scene, highlighting iconic landmarks centered in the composition to showcase precise and delicate modeling.
The scene features soft, refined textures with realistic PBR materials and gentle, lifelike lighting and shadow effects.
Weather elements are creatively integrated into the urban architecture, establishing a dynamic interaction between the city's landscape and atmospheric conditions, creating an immersive weather ambiance.
Use a clean, unified composition with minimalistic aesthetics and a soft, solid-colored background that highlights the main content.
The overall visual style is fresh and soothing.

Display a prominent weather icon at the top-center, with the date (x-small text) and temperature range (medium text) beneath it.
The city name (large text) is positioned directly above the weather icon.
The weather information has no background and can subtly overlap with the buildings.
The text must be in the city's native language.

Weather data for rendering (already retrieved, do not re-query):
- City name: ${cityName}
- Date: ${dateText}
- Weather condition: ${weather.conditionText}
- Weather icon suggestion: ${weather.conditionIcon}
- Temperature range: ${tempRange}

Make sure the final card clearly displays:
City name:【${cityName}】
Date:【${dateText}】
Temperature range:【${tempRange}】
Weather text:【${weather.conditionText}】
`.trim();
}
