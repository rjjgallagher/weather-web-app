const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const WeatherSchema = new Schema({
  location: {
    type: String,
    required: true,
  },
  forecast: [
    {
      date: {
        type: String,
        required: true,
      },
      temp: {
        high: Number,
        low: Number,
      },
    },
  ],
  data: {
    description: String,
    currentTemp: Number,
    highTemp: Number,
    lowTemp: Number,
    visibility: Number,
    humidity: String,
    cloudiness: String,
    sunrise: String,
    sunset: String,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Weather", WeatherSchema);