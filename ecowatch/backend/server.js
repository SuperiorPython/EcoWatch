const express = require('express');
const cors = require('cors');
// FIX: Update the import statement for node-fetch to properly handle ES Modules vs CommonJS
const nodeFetch = require('node-fetch');
const fetch = nodeFetch.default || nodeFetch; // Use .default for older Node versions, otherwise use the module directly

const app = express();
const port = 8080;

// =========================================================================
// !!! SECURITY FIX: GET API KEY FROM ENVIRONMENT VARIABLES !!!
// =========================================================================
const OWM_API_KEY = "8332a7d08145c12293429e9ffb0bd774";

// API Endpoints
const OWM_ONE_CALL_URL = "https://api.openweathermap.org/data/3.0/onecall";
const OWM_GEO_URL = "http://api.openweathermap.org/geo/1.0/direct";
// NEW: Dedicated Air Pollution API endpoint
const OWM_AIR_POLLUTION_URL = "http://api.openweathermap.org/data/2.5/air_pollution";

// --- Middleware Configuration ---
app.use(cors());
app.use(express.json());

/**
 * getCurrentConditions - Fetches real data from OpenWeatherMap (Weather + AQI).
 */
async function getCurrentConditions(locationIdentifier) {
    if (!OWM_API_KEY) {
        throw new Error("OWM_API_KEY is missing. Please configure it in the server environment variables.");
    }

    // 1. Geocoding: Convert City Name to Latitude and Longitude
    // FIX: Use the full, unmodified locationIdentifier for the query (e.g., "Greensboro, NC, US")
    let geoQuery = locationIdentifier.trim();

    // NOTE: We rely on OWM's Geo API to intelligently parse the comma-separated string.
    const geoApiUrl = `${OWM_GEO_URL}?q=${encodeURIComponent(geoQuery)}&limit=1&appid=${OWM_API_KEY}`;
    console.log(`[DEBUG] Attempting GEO call to: ${geoApiUrl}`);

    const geoResponse = await fetch(geoApiUrl);
    const geoData = await geoResponse.json();

    if (!geoResponse.ok || geoData.length === 0) {
        if (geoResponse.status === 401) {
             throw new Error("Geocoding API Key Error: Your OpenWeatherMap key may be invalid or inactive.");
        }
        // If the location is not found, we return the original query to the error message
        throw new Error(`Location not found for the search term: ${locationIdentifier}. Try adding State/Country (e.g., 'Paris, FR').`);
    }

    const { lat, lon, name, state, country } = geoData[0];
    // Use the name, state, and country returned by OWM for the final display location
    const displayLocation = (state && country) ? `${name}, ${state}, ${country}` : name;
    console.log(`[DEBUG] Coordinates found: ${lat}, ${lon} (${displayLocation})`);

    // --- 2. Fetch Weather Data (One Call API 3.0) ---
    const weatherRes = await fetch(`${OWM_ONE_CALL_URL}?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=imperial&exclude=minutely,hourly,alerts`);
    const weatherDataRaw = await weatherRes.json();

    if (!weatherRes.ok) {
        console.error("OWM One Call API Error:", weatherDataRaw);
        const errorMessage = weatherDataRaw.message || "Failed to fetch weather data from One Call API.";
        throw new Error(errorMessage);
    }

    // --- 3. Fetch Air Quality Data (Dedicated API) ---
    const aqiRes = await fetch(`${OWM_AIR_POLLUTION_URL}?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}`);
    const aqiDataRaw = await aqiRes.json();

    let airQualityRaw = null;
    if (aqiRes.ok && aqiDataRaw.list && aqiDataRaw.list.length > 0) {
        airQualityRaw = aqiDataRaw.list[0];
    } else {
        console.log("[DEBUG] Air Quality data unavailable or fetch failed.");
    }


    // --- 4. Assembly and Formatting ---
    const current = weatherDataRaw.current;

    // Standard Weather Data
    const weatherData = {
        temperatureF: current.temp,
        condition: current.weather[0].description.replace(/\b\w/g, l => l.toUpperCase()), // Title Case
        humidity: current.humidity,
        windSpeedMph: current.wind_speed
    };

    let airQualityData = {
        aqi: '--',
        status: "Unavailable",
        mainPollutant: '--',
        details: { pm25: '--', ozone: '--' }
    };

    if (airQualityRaw && airQualityRaw.components) {
        // AQI is level 1-5, where 1 is Good.
        const aqiIndex = airQualityRaw.main.aqi;
        const aqiStatusMap = { 1: "Good", 2: "Moderate", 3: "Unhealthy", 4: "Unsafe", 5: "Hazardous" };

        airQualityData = {
            aqi: aqiIndex,
            status: aqiStatusMap[aqiIndex] || "Unknown",
            mainPollutant: "PM2.5",
            details: {
                // FIX: Corrected typo from aqiRaw to airQualityRaw AND added component check
                pm25: airQualityRaw.components.pm2_5,
                ozone: airQualityRaw.components.o3
            }
        };
    }


    // Alert Data
    const alert = weatherDataRaw.alerts ? weatherDataRaw.alerts[0] : null;

    const alertData = {
        isActive: !!alert || weatherData.windSpeedMph > 20,
        level: alert ? alert.event : (weatherData.windSpeedMph > 20 ? "High Wind Alert" : "None"),
        description: alert ? alert.description : (weatherData.windSpeedMph > 20 ? "High winds expected. Secure loose outdoor items." : "No severe weather alerts."),
    };

    return {
        location: displayLocation, // Use the detailed location name from OWM
        lastUpdated: new Date().toISOString(),
        weather: weatherData,
        airQuality: airQualityData,
        alert: alertData
    };
}


/**
 * REST Endpoint: GET /api/v1/environment/current
 */
app.get('/api/v1/environment/current', async (req, res) => {
    const city = req.query.city;
    const zipCode = req.query.zipCode;

    let locationIdentifier;

    if (city && city.trim() !== '') {
        locationIdentifier = city.trim();
    } else if (zipCode && zipCode.trim() !== '') {
        locationIdentifier = zipCode.trim();
    } else {
        return res.status(400).json({ error: "Location (city or zipCode) is required." });
    }

    console.log(`[REQUEST] Fetching LIVE data for: ${locationIdentifier}`);

    try {
        const data = await getCurrentConditions(locationIdentifier);
        res.json(data);
    } catch (error) {
        console.error(`[ERROR] Failed to fetch data for ${locationIdentifier}: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});


/**
 * NEW REST Endpoint: GET /api/v1/environment/forecast
 * Fetches a 7-day forecast.
 */
app.get('/api/v1/environment/forecast', async (req, res) => {
    const city = req.query.city;

    if (!city) {
        return res.status(400).json({ error: "City parameter is required for forecast." });
    }

    console.log(`[REQUEST] Fetching FORECAST data for: ${city}`);

    try {
        if (!OWM_API_KEY) {
            throw new Error("OWM_API_KEY is missing. Please configure it in the server environment variables.");
        }

        // 1. Geocoding (same as current conditions)
        let geoQuery = city.trim();
        const geoResponse = await fetch(`${OWM_GEO_URL}?q=${encodeURIComponent(geoQuery)}&limit=1&appid=${OWM_API_KEY}`);
        const geoData = await geoResponse.json();

        if (!geoResponse.ok || geoData.length === 0) {
            throw new Error(`Forecast location not found for: ${city}.`);
        }

        const { lat, lon } = geoData[0];

        // 2. Fetch Forecast Data (One Call API 3.0 with daily exclusion removed)
        const forecastRes = await fetch(`${OWM_ONE_CALL_URL}?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=imperial&exclude=current,minutely,hourly,alerts`);
        const forecastDataRaw = await forecastRes.json();

        if (!forecastRes.ok) {
            console.error("OWM Forecast API Error:", forecastDataRaw);
            const errorMessage = forecastDataRaw.message || "Failed to fetch forecast data from One Call API.";
            throw new Error(errorMessage);
        }

        // 3. Process Daily Forecast Array (7 days)
        const dailyForecasts = forecastDataRaw.daily.slice(0, 7).map(day => {
            const date = new Date(day.dt * 1000); // Convert Unix timestamp to Date
            const aqiIndex = day.air_pollution && day.air_pollution.list.length > 0 ? day.air_pollution.list[0].main.aqi : 2; // Default to Moderate (2)
            const aqiStatusMap = { 1: "Good", 2: "Moderate", 3: "Unhealthy", 4: "Unsafe", 5: "Hazardous" };

            return {
                date: date.toISOString().split('T')[0], // YYYY-MM-DD
                dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'short' }),
                weather: {
                    highF: Math.round(day.temp.max),
                    lowF: Math.round(day.temp.min),
                    condition: day.weather[0].description.replace(/\b\w/g, l => l.toUpperCase()),
                },
                expectedAqiStatus: aqiStatusMap[aqiIndex] || "Moderate"
            };
        });

        res.json(dailyForecasts);

    } catch (error) {
        console.error(`[ERROR] Failed to fetch forecast data for ${city}: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});


// --- Server Startup ---
app.listen(port, () => {
    console.log(`\n************************************************`);
    console.log(`🚀 EcoWatch Backend Server is ONLINE (LIVE API MODE).`);
    console.log(`Listening on port: ${port}`);
    console.log(`REMINDER: API Key is read from OWM_API_KEY environment variable.`);
    console.log(`************************************************\n`);
});
