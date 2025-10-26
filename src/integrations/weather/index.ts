// Mock weather data for demonstration
export interface WeatherData {
  location: string;
  temperature: number;
  condition: string;
  humidity: number;
  rainfall_mm: number;
  error?: string;
}

export interface RainfallForecast {
  daily: { date: string; rainfall_mm: number }[];
  total: number;
  error?: string;
}

const mockWeatherData: Record<string, WeatherData> = {
  "28.6139,77.2090": {
    location: "Delhi, India",
    temperature: 32,
    condition: "Partly Cloudy",
    humidity: 65,
    rainfall_mm: 0
  },
  "19.0760,72.8771": {
    location: "Mumbai, India",
    temperature: 30,
    condition: "Hazy",
    humidity: 70,
    rainfall_mm: 0
  },
  "26.8497,80.8021": {
    location: "Kolkata, India",
    temperature: 35,
    condition: "Sunny",
    humidity: 55,
    rainfall_mm: 0
  },
  default: {
    location: "Unknown Location",
    temperature: 25,
    condition: "Clear",
    humidity: 50,
    rainfall_mm: 0,
    error: "Could not fetch weather data"
  }
};

const mockForecastData: Record<string, RainfallForecast> = {
  "28.6139,77.2090": {
    daily: [
      { date: "2024-01-01", rainfall_mm: 0 },
      { date: "2024-01-02", rainfall_mm: 2 },
      { date: "2024-01-03", rainfall_mm: 5 },
      { date: "2024-01-04", rainfall_mm: 1 },
      { date: "2024-01-05", rainfall_mm: 0 },
      { date: "2024-01-06", rainfall_mm: 3 },
      { date: "2024-01-07", rainfall_mm: 8 }
    ],
    total: 19
  },
  default: {
    daily: [],
    total: 0,
    error: "Could not fetch rainfall forecast"
  }
};

export async function getWeatherData(location: string): Promise<WeatherData> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  return mockWeatherData[location] || mockWeatherData.default;
}

export async function getRainfallForecast(location: string): Promise<RainfallForecast> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1200));

  return mockForecastData[location] || mockForecastData.default;
}
