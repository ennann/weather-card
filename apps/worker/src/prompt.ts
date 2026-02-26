export function buildPrompt(city: string): string {
  return `
You have access to Google Search. Search for today's real-time weather in "${city}", then generate a weather card image.

Image style:
Present a clear, 45° top-down view of a vertical (9:16) isometric miniature 3D scene, highlighting iconic landmarks centered in the composition to showcase precise and delicate modeling.
The scene features soft, refined textures with realistic PBR materials and gentle, lifelike lighting and shadow effects.
Weather elements are creatively integrated into the urban architecture, establishing a dynamic interaction between the city's landscape and atmospheric conditions, creating an immersive but restrained weather ambiance.
Use a clean, unified composition with minimalistic aesthetics and a soft, solid-colored background that highlights the main content.
The overall visual style should feel modern, calm, and semi-realistic, avoiding exaggerated cartoon proportions or playful styling.

Text header layout:
Text and weather information should be placed near the top center of the canvas, forming a clearly separated, well-balanced header area with sufficient vertical spacing from the 3D city scene below to prevent visual overlap.
The header is divided horizontally into two parts:
- Left part: a weather emoji. Slightly larger than a single text line, its total height matches the full height of the three-line text group on the right. Prominent but not overpowering.
- Right part: a vertically stacked three-line text group:
  - Top line: city name (largest text size).
  - Middle line: daily temperature range (medium text size, lowest to highest, in ℃).
  - Bottom line: date (smallest text size).
A very subtle, extremely light and thin vertical divider line may be placed between the emoji and the text group, serving only as a gentle visual separator.
Maintain comfortable horizontal spacing between the emoji, divider, and text group. The entire header block should appear centered, aligned, and floating cleanly above the scene, with no background panel.
All text must be in the city's native language.

After generating the image, output ONLY the following JSON as text (no markdown fences, no extra text):
{"city_slug":"<lowercase-romanized-no-spaces>","resolved_name":"<city name on card>","condition":"<weather in native lang>","icon":"<emoji>","temp_min":<int>,"temp_max":<int>,"current_temp":<int>}

city_slug examples: 杭州→hangzhou, 东京→tokyo, 巴黎→paris, New York→newyork, São Paulo→saopaulo
`.trim();
}
