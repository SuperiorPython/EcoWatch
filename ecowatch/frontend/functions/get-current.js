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
// NEW: Geocoding URL for ZIP codes
const OWM_ZIP_GEO_URL = "http://api.openweathermap.org/geo/1.0/zip"; 


// --- Utility Function: Extracts the clean query string (For City only) ---
function getCleanGeoQuery(locationIdentifier) {
    // This is the input: e.g., "Arlington, VA, US"
    const parts = locationIdentifier.split(',').map(p => p.trim());
    
    // We only take the first three non-empty parts: City, State/Region, Country Code
    // This ensures we pass the full, exact string required by OWM.
    return parts.filter(p => p.length > 0).slice(0, 3).join(',');
}


exports.handler = async (event) => {
    // Netlify provides query params in event.queryStringParameters
    const queryParams = event.queryStringParameters;
    const city = queryParams.city; // For city name (e.g., "Arlington, VA, US")
    const zipCode = queryParams.zipCode; // For ZIP code (e.g., "90210" or "27401,US")

    let locationQuery = null;
    let isZip = false;

    if (city && city.trim() !== '') {
        locationQuery = city;
        isZip = false;
    } else if (zipCode && zipCode.trim() !== '') {
        locationQuery = zipCode;
        isZip = true;
    } else {
        return { statusCode: 400, body: JSON.stringify({ error: "Location (city or zipCode) parameter is required." }) };
    }


    try {
        if (!OWM_API_KEY) {
            return { statusCode: 500, body: JSON.stringify({ error: "API Key Missing. OWM_API_KEY must be set in Netlify Environment Variables." }) };
        }

        // --- 1. Geocoding logic: Determine lat/lon based on query type ---
        let geoResponse;
        let geoData;
        let locationNotFoundMessage = null;

        if (isZip) {
            // ZIP code lookup (e.g., ?zip=27401,US)
            // OWM requires ZIP code to be [zip],[country code]
            const zipQuery = locationQuery.includes(',') ? locationQuery : `${locationQuery},US`;
            geoResponse = await fetch(`${OWM_ZIP_GEO_URL}?zip=${encodeURIComponent(zipQuery)}&appid=${OWM_API_KEY}`);
            geoData = await geoResponse.json();

            // ZIP code lookup returns a single object {lat, lon} OR an error {cod, message}
            if (!geoResponse.ok || !geoData.lat) {
                locationNotFoundMessage = `404 Location not found for ZIP code: ${zipCode}.`;
            }
        } else {
            // City name lookup (e.g., ?q=Greensboro,NC,US)
            const geoQuery = getCleanGeoQuery(locationQuery);
            geoResponse = await fetch(`${OWM_GEO_URL}?q=${encodeURIComponent(geoQuery)}&limit=1&appid=${OWM_API_KEY}`);
            const geoArray = await geoResponse.json();
            geoData = geoArray.length > 0 ? geoArray[0] : null;

            if (!geoResponse.ok || geoData === null) {
                locationNotFoundMessage = `404 Location not found for the search term: ${city}.`;
            }
        }
        
        // Handle Geocoding errors
        if (locationNotFoundMessage) {
            return { statusCode: 404, body: JSON.stringify({ error: locationNotFoundMessage }) };
        }

        // Use the common structure for lat/lon
        const { lat, lon } = geoData; 
        
        // Determine the location name for the display (City/State/Country)
        let displayLocation;
        if (isZip) {
            displayLocation = `${geoData.name || locationQuery} (${geoData.zip})`;
        } else {
            displayLocation = (geoData.state && geoData.country) ? `${geoData.name}, ${geoData.state}, ${geoData.country}` : geoData.name;
        }


        // --- 2. Fetch Weather Data ---
        const weatherRes = await fetch(`${OWM_ONE_CALL_URL}?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=imperial&exclude=minutely,hourly,alerts`);
        const weatherDataRaw = await weatherRes.json();
        if (!weatherRes.ok) {
            return { statusCode: 500, body: JSON.stringify({ error: "Failed to fetch weather data from One Call API." }) };
        }

        // --- 3. Fetch Air Quality Data ---
        const aqiRes = await fetch(`${OWM_AIR_POLLUTION_URL}?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}`);
        const aqiDataRaw = await aqiRes.json();
        let airQualityRaw = null;
        if (aqiRes.ok && aqiDataRaw.list && aqiDataRaw.list.length > 0) {
            airQualityRaw = aqiDataRaw.list[0];
        }

        // --- 4. Assembly (Complete DTO construction) ---
        const current = weatherDataRaw.current;
        
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

        return { statusCode: 200, body: JSON.stringify(data) };

    } catch (error) {
        console.error("Function execution error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: `Internal Server Error: ${error.message}` }) };
    }
};
