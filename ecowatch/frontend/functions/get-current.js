/**
 * Netlify Function: Handles /api/v1/environment/current
 * Fetches current weather and AQI data.
 */

// We still need node-fetch because it's running in a Node environment
const fetch = require('node-fetch').default || require('node-fetch');

// API Endpoints
const OWM_API_KEY = process.env.OWM_API_KEY;
const OWM_ONE_CALL_URL = "https://api.openweathermap.org/data/3.0/onecall";
const OWM_GEO_URL = "http://api.openweathermap.org/geo/1.0/direct";
const OWM_AIR_POLLUTION_URL = "http://api.openweathermap.org/data/2.5/air_pollution";

// (The getCurrentConditions logic is too long to show here, but it's identical to the server.js logic)

// [Original getCurrentConditions function from server.js goes here, modified slightly]

exports.handler = async (event) => {
    // Netlify provides query params in event.queryStringParameters
    const queryParams = event.queryStringParameters;
    const city = queryParams.city;

    if (!city) {
        return { statusCode: 400, body: JSON.stringify({ error: "Location (city) parameter is required." }) };
    }

    try {
        if (!OWM_API_KEY) {
            return { statusCode: 500, body: JSON.stringify({ error: "API Key Missing. OWM_API_KEY must be set in Netlify Environment Variables." }) };
        }

        // 1. Geocoding logic (from server.js)
        let geoQuery = city.trim();
        const geoResponse = await fetch(`${OWM_GEO_URL}?q=${encodeURIComponent(geoQuery)}&limit=1&appid=${OWM_API_KEY}`);
        const geoData = await geoResponse.json();

        if (!geoResponse.ok || geoData.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: `Location not found. Please verify spelling or use the format: City, State/Region Code, Country Code (e.g., 'Paris, FR').` }) };
        }

        const { lat, lon, name, state, country } = geoData[0];
        const displayLocation = (state && country) ? `${name}, ${state}, ${country}` : name;

        // 2. Fetch Weather Data
        const weatherRes = await fetch(`${OWM_ONE_CALL_URL}?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=imperial&exclude=minutely,hourly,alerts`);
        const weatherDataRaw = await weatherRes.json();
        if (!weatherRes.ok) {
            return { statusCode: 500, body: JSON.stringify({ error: "Failed to fetch weather data from One Call API." }) };
        }

        // 3. Fetch Air Quality Data
        const aqiRes = await fetch(`${OWM_AIR_POLLUTION_URL}?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}`);
        const aqiDataRaw = await aqiRes.json();
        let airQualityRaw = null;
        if (aqiRes.ok && aqiDataRaw.list && aqiDataRaw.list.length > 0) {
            airQualityRaw = aqiDataRaw.list[0];
        }

        // --- 4. Assembly (Identical to final server.js assembly logic) ---
        // (Due to the size, assuming assembly function is defined elsewhere or is inline)
        const current = weatherDataRaw.current;

        // Assembling DTO (This section is complex, using the final server.js logic)
        // [Final DTO assembly logic is here]

        // Standard Weather Data
        const weatherData = {
            temperatureF: current.temp,
            condition: current.weather[0].description.replace(/\b\w/g, l => l.toUpperCase()),
            humidity: current.humidity,
            windSpeedMph: current.wind_speed
        };

        let airQualityData = { aqi: '--', status: "Unavailable", mainPollutant: '--', details: { pm25: '--', ozone: '--' } };
        if (airQualityRaw && airQualityRaw.components) {
            const aqiIndex = airQualityRaw.main.aqi;
            const aqiStatusMap = { 1: "Good", 2: "Moderate", 3: "Unhealthy", 4: "Unsafe", 5: "Hazardous" };
            airQualityData = {
                aqi: aqiIndex,
                status: aqiStatusMap[aqiIndex] || "Unknown",
                mainPollutant: "PM2.5",
                details: { pm25: airQualityRaw.components.pm2_5, ozone: airQualityRaw.components.o3 }
            };
        }

        const alert = weatherDataRaw.alerts ? weatherDataRaw.alerts[0] : null;
        const alertData = {
            isActive: !!alert || weatherData.windSpeedMph > 20,
            level: alert ? alert.event : (weatherData.windSpeedMph > 20 ? "High Wind Alert" : "None"),
            description: alert ? alert.description : (weatherData.windSpeedMph > 20 ? "High winds expected. Secure loose outdoor items." : "No severe weather alerts."),
        };

        const data = {
            location: displayLocation,
            lastUpdated: new Date().toISOString(),
            weather: weatherData,
            airQuality: airQualityData,
            alert: alertData
        };
        // End Assembly

        return { statusCode: 200, body: JSON.stringify(data) };

    } catch (error) {
        console.error("Function execution error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: `Internal Server Error: ${error.message}` }) };
    }
};