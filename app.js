const express = require('express');
const path = require('path');
const methodOverride = require('method-override');
const axios = require('axios');
const engine = require('ejs-mate');

require('dotenv').config(); // Load environment variables

const db_Url = process.env.DB_URL || 'mongodb://127.0.0.1:27017/weather-app';
mongoose.connect(db_Url);
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

const app = express(); // Create an Express application

app.engine('ejs', engine); // Set the view engine to use the ejs-mate package
app.set('view engine', 'ejs'); // Set the view engine to EJS
app.set('views', path.join(__dirname, 'views')); // Set the views directory

// Middleware to parse URL-encoded data with the querystring library (extended: true uses the qs library)
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method')); // Middleware to override HTTP methods

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Route to render the search page
app.get('/', (req, res) => {
    res.render('search');
});

// Route to search for weather data
app.get('/search', async (req, res) => {
  const location = req.query.location; // Extract city from form submission
  const apiKey = `${process.env.WEATHER_API_KEY}`; // API key from OpenWeatherMap

  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${apiKey}&units=imperial`;

  try {
    const weatherResponse = await axios.get(weatherUrl);
    const weatherData = weatherResponse.data;
      res.render('weatherResult', { weatherData, location });
  } catch (error) {
    console.error(error);
    res.render('search', { error: 'Could not retrieve weather data, please try again.' });
  }
});

// Error handling middleware
app.all('*', (req, res, next) => {
  next(new ExpressError('Page Not Found', 404));
});

// Error handling middleware
app.use((err, req, res, next) => {
  const { statusCode = 500} = err;
  if(!err.message) err.message = 'Something went wrong.';
  res.status(statusCode).render('error', { err });
});

const PORT = process.env.PORT || 3000;
app.listen(process.env.PORT, () => {
  console.log(`Listening on port ${PORT}`);
});