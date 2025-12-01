/**
 * Netlify Function: Handles /api/v1/environment/forecast
 * Fetches 7-day forecast data.
 */

const fetch = require('node-fetch').default || require('node-fetch');

// API Endpoints
const OWM_API_KEY = process.env.OWM_API_KEY; 
const OWM_ONE_CALL_URL = "https://api.openweathermap.org/data/3.0/onecall"; 
const OWM_GEO_URL = "http://api.openweathermap.org/geo/1.0/direct";
// NEW: Geocoding URL for ZIP codes
const OWM_ZIP_GEO_URL = "http://api.openweathermap.org/geo/1.0/zip";

exports.handler = async (event) => {
    // Check for both 'city' (location name) and 'zipCode' parameter
    const city = event.queryStringParameters.city;
    const zipCode = event.queryStringParameters.zipCode;

    let locationQuery = null;
    let isZip = false;

    if (city && city.trim() !== '') {
        locationQuery = city;
        isZip = false;
    } else if (zipCode && zipCode.trim() !== '') {
        locationQuery = zipCode;
        isZip = true;
    } else {
        return { statusCode: 400, body: JSON.stringify({ error: "Location (city or zipCode) parameter is required for forecast." }) };
    }

    try {
        if (!OWM_API_KEY) {
            return { statusCode: 500, body: JSON.stringify({ error: "API Key Missing. OWM_API_KEY must be set in Netlify Environment Variables." }) };
        }

        // --- 1. Geocoding based on type ---
        let geoResponse;
        let geoData;
        let locationNotFoundMessage;

        if (isZip) {
            // ZIP code lookup (e.g., ?zip=27401,US)
            const zipQuery = locationQuery.includes(',') ? locationQuery : `${locationQuery},US`;
            geoResponse = await fetch(`${OWM_ZIP_GEO_URL}?zip=${encodeURIComponent(zipQuery)}&appid=${OWM_API_KEY}`);
            geoData = await geoResponse.json();

            // ZIP code lookup returns a single object {lat, lon} OR an error {cod, message}
            if (!geoResponse.ok || !geoData.lat) {
                locationNotFoundMessage = `Forecast location not found for ZIP code: ${zipCode}.`;
            }
        } else {
            // City name lookup (e.g., ?q=Greensboro,NC,US)
            geoResponse = await fetch(`${OWM_GEO_URL}?q=${encodeURIComponent(locationQuery)}&limit=1&appid=${OWM_API_KEY}`);
            const geoArray = await geoResponse.json();
            geoData = geoArray.length > 0 ? geoArray[0] : null;

            if (!geoResponse.ok || geoData === null) {
                locationNotFoundMessage = `Forecast location not found for: ${city}.`;
            }
        }
        
        // Handle Geo API errors
        if (locationNotFoundMessage) {
            return { statusCode: 404, body: JSON.stringify({ error: locationNotFoundMessage }) };
        }

        const { lat, lon } = geoData;
        
        // 2. Fetch Forecast Data (using lat/lon obtained from either city or zip)
        const forecastRes = await fetch(`${OWM_ONE_CALL_URL}?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=imperial&exclude=current,minutely,hourly,alerts`);
        const forecastDataRaw = await forecastRes.json();
        
        if (!forecastRes.ok) {
            return { statusCode: 500, body: JSON.stringify({ error: "Failed to fetch forecast data from One Call API." }) };
        }

        // 3. Process Daily Forecast Array (7 days - Identical to previous processing)
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
