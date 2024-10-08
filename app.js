const express = require('express');
const path = require('path');
const methodOverride = require('method-override');
const axios = require('axios');
const engine = require('ejs-mate');

require('dotenv').config(); // Load environment variables

const app = express();

app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to parse URL-encoded data with the querystring library (extended: true uses the qs library)
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('search');
});

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

const PORT = process.env.PORT || 3000;
app.listen(process.env.PORT, () => {
    console.log(`Listening on port ${PORT}`);
});