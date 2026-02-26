import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface CityListFile {
  generatedAt: string;
  source: string;
  count: number;
  cities: string[];
}

const CHINA_DIVISION_URL = 'https://unpkg.com/china-division/dist/pca-code.json';
const FALLBACK_CITIES = [
  '北京市',
  '天津市',
  '上海市',
  '重庆市',
  '石家庄市',
  '太原市',
  '呼和浩特市',
  '沈阳市',
  '长春市',
  '哈尔滨市',
  '南京市',
  '杭州市',
  '合肥市',
  '福州市',
  '南昌市',
  '济南市',
  '郑州市',
  '武汉市',
  '长沙市',
  '广州市',
  '南宁市',
  '海口市',
  '成都市',
  '贵阳市',
  '昆明市',
  '拉萨市',
  '西安市',
  '兰州市',
  '西宁市',
  '银川市',
  '乌鲁木齐市',
  '香港',
  '澳门',
  '台北市'
] as const;

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const CITY_FILE = path.join(DATA_DIR, 'cities.json');

type DivisionNode = {
  name: string;
  children?: DivisionNode[];
};

function normalizeCityName(name: string): string {
  return name.replace(/\s+/g, '').trim();
}

function extractCities(provinces: DivisionNode[]): string[] {
  const set = new Set<string>();

  for (const province of provinces) {
    const provinceName = normalizeCityName(province.name);
    const children = province.children ?? [];

    for (const city of children) {
      const rawCityName = normalizeCityName(city.name);
      if (!rawCityName) continue;

      // 直辖市和部分特殊行政区会出现“市辖区”等占位名，回退到省级名称。
      if (
        rawCityName === '市辖区' ||
        rawCityName === '县' ||
        rawCityName === '自治区直辖县级行政区划' ||
        rawCityName === '省直辖县级行政区划'
      ) {
        set.add(provinceName);
      } else {
        set.add(rawCityName);
      }
    }

    if (children.length === 0 && provinceName) {
      set.add(provinceName);
    }
  }

  return [...set].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

function mergeCities(...lists: readonly string[][]): string[] {
  const merged = new Set<string>();
  for (const list of lists) {
    for (const city of list) {
      const normalized = normalizeCityName(city);
      if (normalized) {
        merged.add(normalized);
      }
    }
  }
  return [...merged].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
}

async function writeCityFile(cities: string[], source: string): Promise<CityListFile> {
  await mkdir(DATA_DIR, { recursive: true });
  const payload: CityListFile = {
    generatedAt: new Date().toISOString(),
    source,
    count: cities.length,
    cities
  };
  await writeFile(CITY_FILE, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

export async function syncChinaCityList(force = false): Promise<CityListFile> {
  const existing = await readCityListIfExists();

  if (!force) {
    if (existing && existing.count >= 1) {
      return existing;
    }
  }

  try {
    const response = await fetch(CHINA_DIVISION_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as DivisionNode[];
    const cities = mergeCities(existing?.cities ?? [], extractCities(data));
    if (cities.length < 300) {
      throw new Error(`城市数量异常: ${cities.length}`);
    }
    return writeCityFile(cities, `${CHINA_DIVISION_URL}+local`);
  } catch (error) {
    console.warn(`[city-list] 远程同步失败，使用内置兜底列表。原因: ${String(error)}`);
    if (existing) {
      return existing;
    }
    return writeCityFile([...FALLBACK_CITIES], 'fallback-seed');
  }
}

async function readCityListIfExists(): Promise<CityListFile | null> {
  try {
    const raw = await readFile(CITY_FILE, 'utf8');
    return JSON.parse(raw) as CityListFile;
  } catch {
    return null;
  }
}

export async function loadCityList(): Promise<string[]> {
  const payload = await syncChinaCityList(false);
  return payload.cities;
}

const shouldRunDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (shouldRunDirectly) {
  const force = process.argv.includes('--force');
  syncChinaCityList(force)
    .then((result) => {
      console.log(
        `[city-list] 已写入 ${result.count} 个城市到 ${CITY_FILE}\n来源: ${result.source}`
      );
    })
    .catch((error: unknown) => {
      console.error('[city-list] 同步失败:', error);
      process.exitCode = 1;
    });
}
