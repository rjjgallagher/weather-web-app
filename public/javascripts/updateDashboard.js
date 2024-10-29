function getDay(day) {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return days[day] || "Invalid";
}

function getMonth(month) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return months[month] || "Invalid";
}

document
  .getElementById("searchInput")
  .addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      const location = event.target.value;
      if (location) {
        fetchWeather(location);
        event.target.value = "Search...";
      }
    }
  });

document.addEventListener("DOMContentLoaded", () => {
  // Get the user's local time as an ISO string
  const dateObject = new Date();
  const userTime = dateObject.toLocaleTimeString();
  const day = dateObject.getDay();
  const date = dateObject.getDate();
  const month = dateObject.getMonth();

  // Display the user's time in the dashboard
  const paragraph = document.getElementById("p-userTime");
  if (paragraph) {
    paragraph.textContent = `${getDay(day)}, ${getMonth(
      month
    )} ${date} at ${userTime}`;
  }
});

function updateWeatherData(weatherData) {
  document.getElementById("header-location").textContent = `Forecast in ${weatherData.location}`;
  document.getElementById("current-temp").textContent = `${weatherData.data.currentTemp}°F`;
  document.getElementById("weather-description").textContent = weatherData.data.description;
  document.getElementById("highAndLow-temp").textContent = `High: ${weatherData.data.highTemp}°F, Low: ${weatherData.data.lowTemp}°F`;
  document.getElementById("humidity").textContent = `Humidity: ${weatherData.data.humidity}%`;
  document.getElementById("cloudiness").textContent = `Cloudiness: ${weatherData.data.cloudiness}%`;
  document.getElementById("sunrise").textContent = `Sunrise: ${weatherData.data.sunrise}`;
  document.getElementById("sunset").textContent = `Sunset: ${weatherData.data.sunset}`;

  const forecastContainer = document.getElementById("forecast");
  forecastContainer.innerHTML = "";
  weatherData.forecast.forEach((fore) => {
    const forecastElement = document.createElement("div");
    forecastElement.className = "p-2 bg-light rounded text-center";
    forecastElement.innerHTML = `
        <p>${fore.date}</p>
        <p>${fore.temp.high}°F</p>
      `;
    forecastContainer.appendChild(forecastElement);
  });
}

async function fetchWeather(location) {
  try {
    const response = await fetch(
      `/api/weather?location=${encodeURIComponent(location)}`
    );
    if (response.ok) {
      const weatherData = await response.json();
      updateWeatherData(weatherData);
    } else {
      const errorData = await response.json();
      alert(`Error: ${errorData.message}`);
    }
  } catch (error) {
    console.error("Error fetching weather data:", error);
    alert("An error occurred. Please try again.");
  }
}