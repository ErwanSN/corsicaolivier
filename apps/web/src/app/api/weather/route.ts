import { NextResponse } from "next/server";

const coordinates = [
  { latitude: 43.2965, longitude: 5.3698 },
  { latitude: 41.9192, longitude: 8.7386 },
  { latitude: 36.8065, longitude: 10.1815 },
  { latitude: 36.7538, longitude: 3.0588 }
] as const;

export const revalidate = 1800;

export async function GET() {
  const forecasts = await Promise.all(
    coordinates.map(async ({ latitude, longitude }) => {
      const parameters = new URLSearchParams({
        daily: "weather_code,temperature_2m_max,wind_speed_10m_max,wind_direction_10m_dominant",
        forecast_days: "3",
        latitude: String(latitude),
        longitude: String(longitude),
        timezone: "auto"
      });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${parameters}`, {
        next: { revalidate }
      });
      if (!response.ok) throw new Error(`Open-Meteo responded with ${String(response.status)}`);
      const data = (await response.json()) as {
        daily: {
          temperature_2m_max: number[];
          time: string[];
          weather_code: number[];
          wind_direction_10m_dominant: number[];
          wind_speed_10m_max: number[];
        };
      };
      return data.daily.time.map((date, index) => {
        const temperature = data.daily.temperature_2m_max[index];
        const weatherCode = data.daily.weather_code[index];
        const windDirection = data.daily.wind_direction_10m_dominant[index];
        const windSpeed = data.daily.wind_speed_10m_max[index];
        if (
          [temperature, weatherCode, windDirection, windSpeed].some((value) => value === undefined)
        ) {
          throw new Error("Open-Meteo returned incomplete forecast data");
        }
        return { date, temperature, weatherCode, windDirection, windSpeed };
      });
    })
  );

  return NextResponse.json(forecasts, {
    headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" }
  });
}
