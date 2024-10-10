if (process.env.NODE_ENV !== "production") {
  require('dotenv').config(); // Load environment variables
}

const express = require('express');
const path = require('path');
const methodOverride = require('method-override');
const axios = require('axios');
const engine = require('ejs-mate');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/user');
const ExpressError = require('./utils/ExpressError');


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

// Configure session support
const sessionConfig = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
      httpOnly: true,
      expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
      maxAge: 1000 * 60 * 60 * 24 * 7
  }
}
app.use(session(sessionConfig)); // Enable session support

app.use(passport.initialize()); // Initialize Passport
app.use(passport.session()); // Enable session support
passport.use(new LocalStrategy(User.authenticate())); // Use the LocalStrategy for authentication

passport.serializeUser(User.serializeUser()); // Serialize the user
passport.deserializeUser(User.deserializeUser()); // Deserialize the user

// Middleware to check if the user is authenticated
const isLoggedIn = (req, res, next) => {
  console.log(req.session);
  if (!req.isAuthenticated()) {
    req.session.returnTo = req.originalUrl;
    // TODO: Flash an error message
    return res.redirect('/login');
  }
  next();
};

const setCurrentUser = (req, res, next) => {
  res.locals.currentUser = req.user;
  console.log("set the current user");
  next();
};

app.use(setCurrentUser)

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

// Route to register a new user
app.get('/register', (req, res) => {
    res.render('user/register');
});

// Route to create a new user
app.post('/register', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const user = new User({ email, username });
        const registeredUser = await User.register(user, password);
        req.login(registeredUser, err => {
            if (err) return next(err);
            // TODO: Flash a success message
            res.redirect('/');
        });
    } catch (error) {
      // TODO: Flash an error message
        res.render('register', { error: error.message });
    }
});

app.get('/login', (req, res) => {
    res.render('user/login');
});

app.post('/login', passport.authenticate('local', { failureFlash: true, failureRedirect: '/login' }), (req, res) => {
  // TODO: Flash a success message
  const redirectUrl = res.locals.returnTo || '/'; // If returnTo is not set, redirect to base url
  delete res.locals.returnTo; // Delete the returnTo property from res.locals
  res.redirect(redirectUrl);
});

app.get('/logout', async (req, res) => {
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/');
    });
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