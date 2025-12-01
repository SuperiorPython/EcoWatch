import React, { useState, useEffect, useCallback } from 'react';
import { Cloud, Wind, Droplet, Thermometer, AlertTriangle, Leaf, Search, Sun, CloudRain, Zap, CloudFog, TrendingUp, ChevronDown, ChevronUp, Sunrise, Check, Snowflake } from 'lucide-react';

// --- Configuration ---
// The URL of the Node.js Express server running locally on port 8080.
const API_URL = 'http://localhost:8080/api/v1/environment/current';
const FORECAST_API_URL = 'http://localhost:8080/api/v1/environment/forecast'; // Forecast Endpoint

// Define the initial structure of the data for loading state
const initialDashboardData = {
  location: 'Fetching Location...',
  lastUpdated: null,
  weather: {
    temperatureF: null,
    condition: 'Fetching Data',
    humidity: null,
    windSpeedMph: null,
  },
  airQuality: {
    aqi: null,
    status: '...',
    mainPollutant: '...',
    details: { pm25: null, ozone: null },
  },
  alert: {
    isActive: false,
    level: 'None',
    description: 'No active environmental alerts.',
  },
};

// Initial state for forecast data
const initialForecastData = [];

// Helper function to map AQI status to Tailwind colors
const getAqiColor = (status) => {
  switch (status.toLowerCase()) {
    case 'good':
      return 'bg-green-100 text-green-700 border-green-400';
    case 'moderate':
      return 'bg-yellow-100 text-yellow-700 border-yellow-400';
    case 'unhealthy':
      return 'bg-red-100 text-red-700 border-red-400';
    case 'unsafe':
      return 'bg-purple-100 text-purple-700 border-purple-400';
    case 'hazardous':
      return 'bg-black text-white border-black';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-400';
  }
};

// Helper function to map weather condition to an icon
const getWeatherIcon = (condition) => {
    if (!condition) return Cloud;
    const lower = condition.toLowerCase();
    if (lower.includes('rain') || lower.includes('drizzle') || lower.includes('shower')) return CloudRain;
    if (lower.includes('snow') || lower.includes('sleet')) return Snowflake; // Added Snowflake for snow/sleet
    if (lower.includes('thunderstorm') || lower.includes('lightning')) return Zap;
    if (lower.includes('clear') || lower.includes('sun')) return Sun;
    if (lower.includes('mist') || lower.includes('fog') || lower.includes('haze')) return CloudFog;
    if (lower.includes('cloud') || lower.includes('overcast')) return Cloud;
    return Cloud;
};

// NEW FUNCTION: Maps condition string to Tailwind background classes
const getWeatherBackground = (condition) => {
    if (!condition) return 'bg-gray-50';
    const lower = condition.toLowerCase();

    if (lower.includes('rain') || lower.includes('shower')) {
        return 'from-gray-400 to-gray-500 text-gray-900';
    }
    if (lower.includes('thunderstorm') || lower.includes('snow')) {
        return 'from-gray-600 to-gray-700 text-white';
    }
    if (lower.includes('clear') || lower.includes('sun')) {
        return 'from-blue-200 to-white text-gray-900';
    }
    if (lower.includes('mist') || lower.includes('fog') || lower.includes('haze')) {
        return 'from-gray-200 to-white text-gray-800';
    }
    if (lower.includes('cloud') || lower.includes('overcast')) {
        return 'from-gray-300 to-gray-400 text-gray-900';
    }

    return 'from-gray-50 to-gray-100 text-gray-900'; // Default fallback
};


// --- Sub-Components ---

// VERTICAL AQI BAR GRAPH Component
const AqiBar = ({ aqiIndex, status }) => {
    // AQI Index 1-5 maps directly to a height percentage.
    const HEIGHT_UNIT = 20; // 100% / 5 levels
    const fillHeight = aqiIndex * HEIGHT_UNIT;

    let fillColorClass;
    let pointerColorClass;

    switch (aqiIndex) {
        case 1: fillColorClass = 'bg-green-500'; pointerColorClass = 'text-green-600'; break;
        case 2: fillColorClass = 'bg-yellow-500'; pointerColorClass = 'text-yellow-600'; break;
        case 3: fillColorClass = 'bg-red-500'; pointerColorClass = 'text-red-600'; break;
        case 4: fillColorClass = 'bg-purple-500'; pointerColorClass = 'text-purple-600'; break;
        case 5: fillColorClass = 'bg-gray-900'; pointerColorClass = 'text-gray-900'; break;
        default: fillColorClass = 'bg-gray-400'; pointerColorClass = 'text-gray-500';
    }

    // Calculate vertical position for pointer and text
    // We position the status text absolutely to the left of the bar.

    return (
        <div className="flex justify-start items-end h-36 w-full mb-4">

            {/* Status Labels (Aligned vertically with their corresponding level on the right) */}
            <div className="relative h-full flex flex-col justify-end w-2/3 mr-2">
                {/* AQI Labels 1-5, aligned with the bottom of each 20% block */}
                {['Hazardous', 'Unsafe', 'Unhealthy', 'Moderate', 'Good'].map((label, index) => {
                    const level = 5 - index;
                    const isCurrent = level === aqiIndex;
                    // Calculate the position to center the text in the 20% vertical block
                    const bottomPercent = `${(index) * 20 + 10}%`;

                    return (
                        <div
                            key={level}
                            className={`absolute right-0 text-xs font-semibold transform translate-y-1/2 transition-opacity duration-300 ${isCurrent ? 'opacity-100 text-gray-800' : 'opacity-50 text-gray-500'}`}
                            style={{ bottom: bottomPercent }}
                        >
                            {level}: {label}
                        </div>
                    );
                })}
            </div>

            {/* The Bar Container (1/3 width) */}
            <div className="relative w-1/3 h-full bg-gray-200 rounded-lg overflow-hidden shadow-inner">
                {/* Dynamic Fill Level */}
                <div
                    className={`absolute bottom-0 left-0 w-full ${fillColorClass} transition-all duration-700 ease-out`}
                    style={{ height: `${fillHeight}%` }}
                >
                </div>
                {/* Pointer at the very top of the bar fill (optional visual cue) */}
                {aqiIndex >= 1 && aqiIndex <= 5 && (
                    <div
                        // Triangle points down (border-b) and is black (border-t-gray-900)
                        className={`absolute -top-2 left-1/2 h-0 w-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900 transition-all duration-500`}
                        style={{ transform: 'translateX(-50%)' }}
                    />
                )}
            </div>


            {/* Fallback for unavailable data */}
            {aqiIndex === null && (
                 <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">
                     N/A
                 </div>
            )}
        </div>
    );
};

// Generic Card Layout
const Card = ({ title, icon: Icon, children, className = 'bg-white border-gray-200' }) => (
  <div className={`p-6 border-2 rounded-xl shadow-lg transition duration-300 hover:shadow-xl ${className}`}>
    <h2 className="text-lg font-bold flex items-center border-b pb-2 mb-3 text-gray-700">
      <Icon size={20} className="mr-2" />
      {title}
    </h2>
    {children}
  </div>
);

// Detail Row for Weather Card
const DetailRow = ({ icon: Icon, label, value }) => (
    <div className="flex justify-between items-center text-sm text-gray-600 py-1">
        <span className="flex items-center">
            <Icon size={16} className="mr-2 text-gray-500" />
            {label}
        </span>
        <span className="font-semibold text-gray-800">{value}</span>
    </div>
);

// Forecast Day Renderer Component
const ForecastDay = ({ day, unit }) => { // unit prop added
    const Icon = getWeatherIcon(day.weather.condition);
    const aqiColor = day.expectedAqiStatus.toLowerCase() === 'good' ? 'text-green-600' : 'text-yellow-600';

    // Conversion logic for forecast
    const convertToC = (temp) => ((temp - 32) * 5 / 9);

    const highTemp = unit === 'C' ? convertToC(day.weather.highF).toFixed(0) : day.weather.highF;
    const lowTemp = unit === 'C' ? convertToC(day.weather.lowF).toFixed(0) : day.weather.lowF;
    const displayUnit = unit === 'C' ? '°C' : '°F';


    return (
        <div className="flex flex-col items-center p-4 bg-white border border-gray-200 rounded-xl shadow-md transition duration-200 hover:shadow-lg">
            <p className="text-sm font-semibold text-gray-600">{day.dayOfWeek}</p>
            <Icon size={32} className="text-blue-500 my-2" />
            <p className="text-lg font-bold text-gray-800">{highTemp}{displayUnit} / {lowTemp}{displayUnit}</p>
            <p className="text-xs text-gray-500">{day.weather.condition}</p>
            <p className={`text-xs mt-1 font-medium ${aqiColor}`}>AQI: {day.expectedAqiStatus}</p>
        </div>
    );
  };


// --- Main Application Component ---
const App = () => {
  const [data, setData] = useState(initialDashboardData);
  const [forecastData, setForecastData] = useState(initialForecastData); // NEW STATE

  // FIX: Update default value to explicitly show the required format
  const [locationInput, setLocationInput] = useState('New York, NY, US');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // NEW STATE: Unit toggle
  const [unit, setUnit] = useState('F'); // 'F' for Fahrenheit, 'C' for Celsius

  // Conversion function
  const convertToC = (temp) => ((temp - 32) * 5 / 9);


  // Maps weather condition to smooth background gradient
  const getWeatherBackground = (condition) => {
    if (!condition) return 'bg-gray-50';
    const lower = condition.toLowerCase();

    if (lower.includes('rain') || lower.includes('shower')) {
        return 'from-gray-400 to-gray-500 text-gray-900';
    }
    if (lower.includes('thunderstorm') || lower.includes('snow')) {
        return 'from-gray-600 to-gray-700 text-white';
    }
    if (lower.includes('clear') || lower.includes('sun')) {
        return 'from-blue-200 to-white text-gray-900';
    }
    if (lower.includes('mist') || lower.includes('fog') || lower.includes('haze')) {
        return 'from-gray-200 to-white text-gray-800';
    }
    if (lower.includes('cloud') || lower.includes('overcast')) {
        return 'from-gray-300 to-gray-400 text-gray-900';
    }

    return 'from-gray-50 to-gray-100 text-gray-900'; // Default fallback
  };

  // New function to fetch 7-day forecast
  const fetchForecast = useCallback(async (loc) => {
    try {
        const response = await fetch(`${FORECAST_API_URL}?city=${loc}`);
        if (!response.ok) {
            // FIX: If the forecast endpoint returns an error, we read the body to get the specific message
            const errorBody = await response.json();
            throw new Error(errorBody.error || `Forecast API Error! Status: ${response.status}. Check server console.`);
        }
        const json = await response.json();
        setForecastData(json);
    } catch (err) {
        console.error("Forecast fetch error:", err);
        setForecastData([]);
    }
  }, []);


  // Function to fetch current conditions
  const fetchCurrentConditions = useCallback(async (loc) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}?city=${loc}`);

      if (!response.ok) {
        throw new Error(`API Error! Status: ${response.status}`);
      }

      const json = await response.json();

      json.lastUpdated = new Date(json.lastUpdated).toLocaleTimeString();
      setData(json);

      // Successfully fetched current data, now fetch forecast
      fetchForecast(loc);

    } catch (err) {
      console.error("Fetch error:", err);
      // ENHANCED ERROR REPORTING: Check for specific "Location not found" message
      if (err.message.includes('Location not found')) {
        setError("Location not found. Please verify spelling or use the format: City, State/Region Code, Country Code (e.g., 'Paris, FR').");
      } else if (err.message.includes('Failed to fetch')) {
        setError('Could not connect to Node.js backend server. Please ensure server.js is running on port 8080.');
      } else {
        // Display the specific message returned by the backend's catch block
        setError(`Data fetch failed: ${err.message}`);
      }
      setData(initialDashboardData);
      setForecastData([]); // Clear forecast on error

    } finally {
      setLoading(false);
    }
  }, [fetchForecast]); // dependency on fetchForecast


  // Initial data load when component mounts
  useEffect(() => {
    fetchCurrentConditions(locationInput);
  }, [fetchCurrentConditions]);

  // Handler for form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    fetchCurrentConditions(locationInput);
  };

  const { weather, airQuality, alert, lastUpdated, location } = data;
  const aqiClassName = getAqiColor(airQuality.status);
  const backgroundClasses = getWeatherBackground(weather.condition);

  // Apply unit conversion logic to current temperature
  const currentTempF = weather.temperatureF;
  const displayTemp = unit === 'C' && currentTempF !== null
                      ? convertToC(currentTempF).toFixed(1)
                      : (currentTempF !== null ? currentTempF.toFixed(1) : '--');
  const displayUnit = unit === 'C' ? '°C' : '°F';

  const formatWind = (wind) => wind !== null ? wind.toFixed(1) : '--';

  const WeatherIcon = getWeatherIcon(weather.condition);
  const AlertIcon = alert.isActive ? AlertTriangle : Thermometer;


  return (
    // Applied the dynamic background class here
    <div className={`min-h-screen flex flex-col items-center p-4 sm:p-8 font-sans transition-colors duration-500 bg-gradient-to-br ${backgroundClasses}`}>

      {/* Header and Search */}
      <div className="w-full max-w-4xl bg-white shadow-xl rounded-2xl p-6 mb-8">
        <h1 className="text-3xl font-bold text-center text-gray-800">EcoWatch Environmental Dashboard</h1>
        <p className="text-center text-sm text-gray-500 mt-1 mb-6">Full-Stack Demo: React Frontend calling Node.js Backend.</p>

        <form onSubmit={handleSubmit} className="flex max-w-xl mx-auto">
          <input
            type="text"
            value={locationInput}
            onChange={(e) => setLocationInput(e.target.value)}
            // FIX: Update placeholder to guide user to the exact format needed for disambiguation
            placeholder="City, State/Region Code, Country Code (e.g., 'Paris, FR')"
            className="flex-grow p-3 border-2 border-gray-300 rounded-l-xl focus:ring-blue-500 focus:border-blue-500 outline-none transition duration-150"
            required
            disabled={loading}
          />
          <button
            type="submit"
            className="p-3 bg-blue-600 text-white rounded-r-xl hover:bg-blue-700 transition duration-150 flex items-center justify-center disabled:opacity-50"
            disabled={loading}
          >
            {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : (
                <Search size={20} />
            )}
          </button>
        </form>
        {location && location !== initialDashboardData.location && (
            <p className="text-center text-sm text-gray-500 mt-3">
                Current data simulated for: <span className="font-semibold text-gray-700">{location}</span>
            </p>
        )}
      </div>

      {/* Error Message Display */}
      {error && (
        <div className="w-full max-w-4xl p-4 mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg shadow-md">
          <p className="font-semibold">Connection Required!</p>
          <p className="text-sm">{error}</p>
          <p className="text-xs mt-2">To fix: Go to the 'backend/' folder, ensure API key is set, and run `node server.js`.</p>
        </div>
      )}


      {/* Dashboard Cards (Responsive Grid) */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

        {/* 1. Weather Conditions Card */}
        <Card title="Weather Conditions" icon={Cloud} className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300">
          <div className="flex flex-col items-start my-4">
              {/* Unit Toggle and Temperature Display Container */}
              <div className="flex items-center justify-between w-full">
                  <div className="flex flex-col items-start">
                      {/* Unit Toggle */}
                      <div className="flex items-center bg-gray-100 rounded-xl p-1 border border-gray-300 mb-2">
                          <button
                              onClick={() => setUnit('C')}
                              className={`px-2 py-1 text-xs font-bold rounded-lg transition-colors ${unit === 'C' ? 'bg-blue-500 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}
                              aria-pressed={unit === 'C'}
                          >
                              °C
                          </button>
                          <button
                              onClick={() => setUnit('F')}
                              className={`px-2 py-1 text-xs font-bold rounded-lg transition-colors ${unit === 'F' ? 'bg-blue-500 text-white shadow' : 'text-gray-600 hover:bg-gray-200'}`}
                              aria-pressed={unit === 'F'}
                          >
                              °F
                          </button>
                      </div>
                      {/* Large Temperature Display */}
                      <span className="text-4xl font-extrabold text-blue-800">
                          {displayTemp}{displayUnit}
                      </span>
                  </div>
                  {/* Weather Icon */}
                  <WeatherIcon size={64} className="text-blue-500" />
              </div>
          </div>
          <p className="text-xl font-semibold text-gray-800 mb-4">{weather.condition}</p>

          <DetailRow icon={Droplet} label="Humidity" value={`${weather.humidity ?? '--'}%`} />
          <DetailRow icon={Wind} label="Wind Speed" value={`${formatWind(weather.windSpeedMph)} mph`} />
        </Card>

        {/* 2. Air Quality Index (AQI) Card */}
        <Card title="Air Quality Index (AQI)" icon={Leaf} className={aqiClassName}>
            {/* Vertical Bar Graph Component */}
            <AqiBar aqiIndex={airQuality.aqi} status={airQuality.status} />

            <div className="flex justify-between text-sm pt-2 border-t border-gray-300">
                <span className="font-medium">PM2.5: <span className="font-bold">{airQuality.details.pm25 !== null ? airQuality.details.pm25.toFixed(2) : '--'} µg/m³</span></span>
                <span className="font-medium">Ozone: <span className="font-bold">{airQuality.details.ozone !== null ? airQuality.details.ozone.toFixed(2) : '--'} ppb</span></span>
            </div>
        </Card>

        {/* 3. Local Alert Level Card */}
        <Card
            title="Local Alert Level"
            icon={AlertTriangle}
            className={`transition duration-300 ${alert.isActive ? 'bg-red-100 border-red-500' : 'bg-green-50 border-green-400'}`}
        >
            <div className="flex flex-col items-center justify-center h-28">
                {alert.isActive ? (
                    <AlertIcon size={64} className="text-red-500 animate-pulse" />
                ) : (
                    <AlertIcon size={64} className="text-green-500" />
                )}
                <p className={`text-xl font-bold text-center mt-2 ${alert.isActive ? 'text-red-700' : 'text-gray-700'}`}>
                    {alert.isActive ? alert.level : 'No Current Alerts'}
                </p>
            </div>

            <p className="text-sm mt-4 text-gray-600 border-t pt-3">
                {alert.isActive ? alert.description : 'The local environment is currently stable.'}
            </p>
        </Card>
      </div>

      {/* NEW: Forecast Section */}
      {forecastData.length > 0 && (
          <div className="w-full max-w-4xl bg-white shadow-xl rounded-2xl p-6 mt-6">
              <h2 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-4 flex items-center">
                  <TrendingUp size={24} className="mr-2 text-blue-600" />
                  7-Day Forecast for {location}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4">
                  {forecastData.map((day, index) => (
                      <ForecastDay key={index} day={day} unit={unit} />
                  ))}
              </div>
          </div>
      )}


      {/* Footer */}
      <footer className="mt-12 text-sm text-gray-500 text-center">
        {loading ? 'Connecting to backend...' : `Last Simulated Update: ${lastUpdated ? lastUpdated : 'N/A'}`}
        <p className="mt-1">
            Built with React and Node.js/Express | Portfolio Project
        </p>
      </footer>
    </div>
  );
};

export default App;
