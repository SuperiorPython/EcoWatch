/**
 * Netlify Function: Handles /api/v1/environment/forecast
 * Fetches 7-day forecast data.
 */

const fetch = require('node-fetch').default || require('node-fetch');

// API Endpoints
const OWM_API_KEY = process.env.OWM_API_KEY;
const OWM_ONE_CALL_URL = "https://api.openweathermap.org/data/3.0/onecall";
const OWM_GEO_URL = "http://api.openweathermap.org/geo/1.0/direct";

exports.handler = async (event) => {
    const city = event.queryStringParameters.city;

    if (!city) {
        return { statusCode: 400, body: JSON.stringify({ error: "City parameter is required for forecast." }) };
    }

    try {
        if (!OWM_API_KEY) {
            return { statusCode: 500, body: JSON.stringify({ error: "API Key Missing. OWM_API_KEY must be set in Netlify Environment Variables." }) };
        }

        // 1. Geocoding
        const geoResponse = await fetch(`${OWM_GEO_URL}?q=${encodeURIComponent(city)}&limit=1&appid=${OWM_API_KEY}`);
        const geoData = await geoResponse.json();

        if (!geoResponse.ok || geoData.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: `Forecast location not found for: ${city}.` }) };
        }

        const { lat, lon } = geoData[0];

        // 2. Fetch Forecast Data
        const forecastRes = await fetch(`${OWM_ONE_CALL_URL}?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=imperial&exclude=current,minutely,hourly,alerts`);
        const forecastDataRaw = await forecastRes.json();

        if (!forecastRes.ok) {
            return { statusCode: 500, body: JSON.stringify({ error: "Failed to fetch forecast data from One Call API." }) };
        }

        // 3. Process Daily Forecast Array (7 days - Identical to server.js processing)
        const dailyForecasts = forecastDataRaw.daily.slice(0, 7).map(day => {
            const date = new Date(day.dt * 1000);
            const aqiIndex = day.air_pollution && day.air_pollution.list.length > 0 ? day.air_pollution.list[0].main.aqi : 2;
            const aqiStatusMap = { 1: "Good", 2: "Moderate", 3: "Unhealthy", 4: "Unsafe", 5: "Hazardous" };

            return {
                date: date.toISOString().split('T')[0],
                dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'short' }),
                weather: {
                    highF: Math.round(day.temp.max),
                    lowF: Math.round(day.temp.min),
                    condition: day.weather[0].description.replace(/\b\w/g, l => l.toUpperCase()),
                },
                expectedAqiStatus: aqiStatusMap[aqiIndex] || "Moderate"
            };
        });

        return { statusCode: 200, body: JSON.stringify(dailyForecasts) };

    } catch (error) {
        console.error("Forecast function error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: `Internal Server Error: ${error.message}` }) };
    }
};