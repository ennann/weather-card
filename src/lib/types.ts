export interface GenerationRun {
  id: number;
  run_id: string;
  city: string;
  resolved_city_name: string | null;
  weather_date: string;
  weather_condition: string | null;
  weather_icon: string | null;
  temp_min: number | null;
  temp_max: number | null;
  current_temp: number | null;
  model: string | null;
  image_r2_key: string | null;
  status: 'running' | 'succeeded' | 'failed';
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}
