export function buildPrompt(city: string): string {
  return `
You have access to Google Search. Search for today's real-time weather in "${city}", then generate a weather card image.

Image style:
Present a clear, 45° top-down view of a vertical (9:16) isometric miniature 3D cartoon scene, highlighting iconic landmarks centered in the composition to showcase precise and delicate modeling.
The scene features soft, refined textures with realistic PBR materials and gentle, lifelike lighting and shadow effects.
Weather elements are creatively integrated into the urban architecture, establishing a dynamic interaction between the city's landscape and atmospheric conditions, creating an immersive weather ambiance.
Use a clean, unified composition with minimalistic aesthetics and a soft, solid-colored background that highlights the main content.
The overall visual style is fresh and soothing.

Text overlay:
Display a prominent weather icon at the top-center, with the date (x-small text) and temperature range (medium text) beneath it.
The city name (large text) is positioned directly above the weather icon.
The weather information has no background and can subtly overlap with the buildings.
The text must be in the city's native language.

After generating the image, output ONLY the following JSON as text (no markdown fences, no extra text):
{"city_slug":"<lowercase-romanized-no-spaces>","resolved_name":"<city name on card>","condition":"<weather in native lang>","icon":"<emoji>","temp_min":<int>,"temp_max":<int>,"current_temp":<int>}

city_slug examples: 杭州→hangzhou, 东京→tokyo, 巴黎→paris, New York→newyork, São Paulo→saopaulo
`.trim();
}
