import { pinyin } from 'pinyin-pro';
import { readFileSync, writeFileSync } from 'fs';

const data = JSON.parse(readFileSync('data/cities.json', 'utf-8'));

const special: Record<string, string> = {
  '東京': 'tokyo',
  '大阪': 'osaka',
  '京都': 'kyoto',
  '横浜': 'yokohama',
  'ソウル': 'seoul',
  '釜山': 'busan',
};

function slugify(city: string): string {
  if (special[city]) return special[city];
  if (/^[\x00-\x7F]+$/.test(city)) {
    return city.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  const py = pinyin(city, { toneType: 'none', type: 'array' });
  return py.join('').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const slugs: Record<string, string> = {};
for (const city of data.cities) {
  slugs[city] = slugify(city);
}

writeFileSync('data/city-slugs.json', JSON.stringify(slugs, null, 2) + '\n');
console.log(`Generated ${Object.keys(slugs).length} slug entries`);

const samples = ['北京', '上海', '杭州', '成都', '呼和浩特', '東京', 'ソウル', 'New York', 'Tokyo'];
for (const s of samples) {
  console.log(`  ${s} → ${slugs[s] || '(not in list)'}`);
}
