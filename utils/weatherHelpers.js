const axios = require("axios");
const Weather = require("../models/weather");

// Utility function to convert kilometers to miles
const convertKmToMi = (meters) => Math.floor(meters * 0.00062137);
// Utility function to convert Unix time to local time
function convertUnixToLocalTime(unixTime, timezoneOffset) {
  // Create a Date object using the Unix time (multiply by 1000 to convert to milliseconds)
  const date = new Date(unixTime * 1000);
  // Create a new Date object with the timezone offset added to the Unix time
  const localDate = new Date(date.getTime() + timezoneOffset);
  // Return the local time as a string in the format HH:MM AM/PM
  return localDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Utility function that extracts and returns the forecast for noon each day from the forecast data.
 * @param {Array} forecastData - The list of forecast entries.
 * @returns {Array} An array of daily forecasts around noon.
 */
function getNoonForecasts(forecastData) {
  // Create an object to store a single forecast for each date
  const dailyForecasts = [];

  // Iterate through all forecast entries
  forecastData.forEach((forecast) => {
    const date = forecast.dt_txt.split(" ")[1];

    // If it's around noon, store this entry as the forecast for that day
    // Adjust this to match your preferred time, e.g., "12:00:00" for noon
    if (forecast.dt_txt.includes("12:00:00")) {
      dailyForecasts.push({
        date: new Date(forecast.dt * 1000).toLocaleDateString("en-US", {
          weekday: "short",
        }),
        temp: {
          high: Math.round(forecast.main.temp_max),
          low: Math.round(forecast.main.temp_min),
        },
        description: forecast.weather[0].description,
      });
    }
  });

  // Return an array of forecasts for each day
  return Object.values(dailyForecasts);
}

/**
 * Fetch weather data from the OpenWeatherMap API and cache it in the database.
 * @param {String} location - The location for which to fetch weather data.
 * @returns {Object} The weather data object.
 */
async function fetchAndCacheNewWeatherData(location) {
  const apiKey = process.env.WEATHER_API_KEY;
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${location}&appid=${apiKey}&units=imperial`;
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${apiKey}&units=imperial`;

  try {
    const [weatherResponse, forecastResponse] = await Promise.all([
      axios.get(weatherUrl),
      axios.get(forecastUrl),
    ]);

    const forecasts = forecastResponse.data.list;
    const weatherData = weatherResponse.data;

    const forecast = getNoonForecasts(forecasts);
    const sunrise = convertUnixToLocalTime(weatherData.sys.sunrise, weatherData.timezone);
    const sunset = convertUnixToLocalTime(weatherData.sys.sunset, weatherData.timezone);
    const newWeatherData = {
      location,
      forecast,
      data: {
        description: weatherData.weather[0].description,
        currentTemp: Math.floor(weatherData.main.temp),
        highTemp: Math.floor(weatherData.main.temp_max),
        lowTemp: Math.floor(weatherData.main.temp_min),
        visibility: convertKmToMi(weatherData.visibility),
        humidity: weatherData.main.humidity,
        cloudiness: weatherData.clouds.all,
        sunrise,
        sunset,
      },
      lastUpdated: new Date(),
    };

    // Save the weather data in the database for caching
    await Weather.findOneAndUpdate({ location }, newWeatherData, {
      upsert: true,
      new: true,
    });

    return newWeatherData;
  } catch (error) {
    console.error("Error fetching or caching weather data:", error);
    throw new Error("Failed to fetch or cache weather data");
  }
}

/**
 * Check and update stale weather data for a list of locations.
 * @param {Array} locations - An array of locations to check for stale data.
 */
async function checkAndUpdateStaleWeatherData(locations) {
  const cacheDuration = 15 * 60 * 1000; // 15 minutes in milliseconds

  for (const location of locations) {
    let weather = await Weather.findOne({ location });

    const isDataStale =
      weather && Date.now() - weather.lastUpdated.getTime() >= cacheDuration;

    // If no data exists or the data is stale, fetch and cache the new data
    if (!weather || isDataStale) {
      await fetchAndCacheNewWeatherData(location);
    }
  }
}

/**
 * Retrieve weather data for a specific location from the database.
 * If the data is stale or does not exist, fetch and cache new data.
 * @param {String} location - The location for which to retrieve weather data.
 * @returns {Object} The weather data object.
 */
async function getWeatherData(location) {
  const cacheDuration = 15 * 60 * 1000; // 15 minutes in milliseconds
  let weather = await Weather.findOne({ location });

  // Check if cached data exists and is fresh
  const isDataFresh =
    weather && Date.now() - weather.lastUpdated.getTime() < cacheDuration;

  if (!isDataFresh) {
    // If no valid cache, fetch new data and update the cache
    weather = await fetchAndCacheNewWeatherData(location);
  }
  return weather;
}

module.exports = {
  checkAndUpdateStaleWeatherData,
  getWeatherData,
};