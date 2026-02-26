export interface WeatherInfo {
  city: string;
  resolvedCityName: string;
  latitude: number;
  longitude: number;
  date: string;
  conditionText: string;
  conditionIcon: string;
  tempMin: number;
  tempMax: number;
  currentTemp: number;
}

type GeocodeResult = {
  name: string;
  country_code: string;
  latitude: number;
  longitude: number;
};

type GeocodeResponse = {
  results?: GeocodeResult[];
};

type WeatherResponse = {
  current?: {
    temperature_2m: number;
    weather_code: number;
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
  };
};

function mapWeatherCodeToText(code: number): { text: string; icon: string } {
  if (code === 0) return { text: '晴', icon: '☀️' };
  if (code >= 1 && code <= 3) return { text: '多云', icon: '⛅' };
  if (code === 45 || code === 48) return { text: '雾', icon: '🌫️' };
  if (code >= 51 && code <= 57) return { text: '毛毛雨', icon: '🌦️' };
  if (code >= 61 && code <= 67) return { text: '降雨', icon: '🌧️' };
  if (code >= 71 && code <= 77) return { text: '降雪', icon: '🌨️' };
  if (code >= 80 && code <= 82) return { text: '阵雨', icon: '🌦️' };
  if (code >= 85 && code <= 86) return { text: '阵雪', icon: '🌨️' };
  if (code === 95) return { text: '雷暴', icon: '⛈️' };
  if (code >= 96 && code <= 99) return { text: '强雷暴', icon: '⛈️' };
  return { text: '未知天气', icon: '❓' };
}

async function resolveCity(city: string): Promise<GeocodeResult> {
  const query = city.replace(/市$/u, '');
  const url =
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}` +
    '&count=10&language=zh&format=json';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`地理编码请求失败: HTTP ${res.status}`);
  }
  const data = (await res.json()) as GeocodeResponse;
  const cnResult = data.results?.find((item) => item.country_code === 'CN');
  const first = data.results?.[0];
  const chosen = cnResult ?? first;
  if (!chosen) {
    throw new Error(`未找到城市坐标: ${city}`);
  }
  return chosen;
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherResponse> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,weather_code' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
    '&forecast_days=1&timezone=Asia%2FShanghai';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`天气请求失败: HTTP ${res.status}`);
  }
  return (await res.json()) as WeatherResponse;
}

export async function getCurrentWeather(city: string): Promise<WeatherInfo> {
  const geo = await resolveCity(city);
  const weather = await fetchWeather(geo.latitude, geo.longitude);
  const current = weather.current;
  const daily = weather.daily;
  if (!current || !daily) {
    throw new Error(`天气数据不完整: ${city}`);
  }

  const weatherCode = daily.weather_code?.[0] ?? current.weather_code;
  const mapped = mapWeatherCodeToText(weatherCode);

  return {
    city,
    resolvedCityName: geo.name,
    latitude: geo.latitude,
    longitude: geo.longitude,
    date: daily.time[0],
    conditionText: mapped.text,
    conditionIcon: mapped.icon,
    tempMin: Math.round(daily.temperature_2m_min[0]),
    tempMax: Math.round(daily.temperature_2m_max[0]),
    currentTemp: Math.round(current.temperature_2m)
  };
}
