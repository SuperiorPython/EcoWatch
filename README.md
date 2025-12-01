## 🌎 EcoWatch Environmental Dashboard

This project is a modern, full-stack application designed to provide users with real-time weather, air quality data (AQI), and a 7-day forecast for any specific location. It serves as a comprehensive portfolio piece demonstrating proficiency in modern JavaScript frameworks, secure API handling, and serverless deployment.

Live Demo: https://ecowatch-dashboard.netlify.app/

## ✨ Key Features

Full-Stack Architecture: Separated React client and Node.js Serverless Functions backend.

Secure API Integration: Data fetched live from OpenWeatherMap (Weather, Forecast, and Air Pollution APIs). API key is secured via Netlify Environment Variables.

Dynamic UX: Application background smoothly transitions based on the current weather condition (e.g., Clear Sky, Rain, Thunderstorm).

Interactive Units: Toggle button allows instant switching between Fahrenheit (°F) and Celsius (°C).

Advanced Data Visualization: Custom-built vertical bar graph visualizes Air Quality Index (AQI) levels (1-5), clearly indicating risk level.

Robust Error Handling: Specific error messages guide the user on how to correctly format search queries (City, State Code, Country Code).

## 💻 Tech Stack

Component

Technology

Role

Frontend (Client)

React, JavaScript

User interface, state management, C/F unit conversion, data presentation, and dynamic styling (Tailwind CDN).

Backend (API)

Node.js, Netlify Functions

API Proxy: Geocodes location, securely fetches data from multiple OWM endpoints, and formats the response for the frontend.

Deployment

Netlify

Hosts the React client and executes the Serverless Functions.

## 📐 Architecture

The application follows a secure client-server pattern where the frontend never directly exposes the API key.

The React Client makes a request to the relative path: /api/v1/environment/current?city=...

Netlify's Redirects intercept this path and route it to the Netlify Serverless Function (get-current.js).

The Serverless Function securely reads the OWM_API_KEY from Netlify's environment, calls the external OpenWeatherMap service, aggregates the data, and sends a clean JSON response back to the client.

Key: OWM_API_KEY

Value: [Your Secret Key]
