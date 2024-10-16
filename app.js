if (process.env.NODE_ENV !== "production") {
  require("dotenv").config(); // Load environment variables
}

const express = require("express");
const path = require("path");
const methodOverride = require("method-override");
const axios = require("axios");
const engine = require("ejs-mate");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user");
const ExpressError = require("./utils/ExpressError");

const db_Url = process.env.DB_URL || "mongodb://127.0.0.1:27017/weather-app"; // Database URL
mongoose.connect(db_Url); // Connect to the database
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:")); // Log an error if the connection fails
// Log a message to the console when the database connection is open
db.once("open", () => {
  console.log("Database connected");
});

const app = express(); // Create an Express application

app.engine("ejs", engine); // Set the view engine to use the ejs-mate package
app.set("view engine", "ejs"); // Set the view engine to EJS
app.set("views", path.join(__dirname, "views")); // Set the views directory


app.use(express.json()); // Middleware to parse JSON data in the request body
app.use(express.urlencoded({ extended: true })); // Middleware to parse URL-encoded data with the querystring library (extended: true uses the qs library)
app.use(methodOverride("_method")); // Middleware to override HTTP methods
app.use(express.static(path.join(__dirname, "public"))); // Serve static files from the 'public' directory

// Configure session support
const sessionConfig = {
  secret: process.env.SESSION_SECRET, // Secret used to sign the session ID
  resave: false, // Do not save the session to the store if it hasn't been modified
  saveUninitialized: true, // Save uninitialized sessions to the store (e.g., MongoDB) to allow persistent login sessions
  cookie: {
    httpOnly: true, // Set cookie to be accessible only by the web server
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // Set cookie expiration to 7 days
    maxAge: 1000 * 60 * 60 * 24 * 7, // Set cookie max age to 7 days
  },
};
app.use(session(sessionConfig)); // Enable session support

app.use(passport.initialize()); // Initialize Passport
app.use(passport.session()); // Enable session support

passport.use(new LocalStrategy(User.authenticate())); // Use the LocalStrategy for authentication

passport.serializeUser(User.serializeUser()); // Serialize the user
passport.deserializeUser(User.deserializeUser()); // Deserialize the user

// Middleware to check if the user is authenticated
const isLoggedIn = (req, res, next) => {
  console.log(req.session);
  // If the user is not authenticated, redirect to the login page
  if (!req.isAuthenticated()) {
    req.session.returnTo = req.originalUrl; // Store the original URL in the session
    // TODO: Flash an error message
    return res.redirect("/login"); 
  }
  next(); 
};

// Middleware to set the currentUser variable in the response locals
const setCurrentUser = (req, res, next) => {
  res.locals.currentUser = req.user; // Set the currentUser variable in the response locals
  next();
};

app.use(setCurrentUser);

// Route to render the search page
app.get("/", (req, res) => {
  res.render("search");
});

// Route to render the dashboard page
app.get('/dashboard', (req, res) => {
  res.render('dashboard');
});

// Route to search for weather data
app.get("/search", async (req, res) => {
  const location = req.query.location; // Extract city from form submission
  const apiKey = `${process.env.WEATHER_API_KEY}`; // API key from OpenWeatherMap

  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${apiKey}&units=imperial`;

  try {
    const weatherResponse = await axios.get(weatherUrl); // Make a GET request to the weather API
    const weatherData = weatherResponse.data; 
    res.render("weatherResult", { weatherData, location }); // Render the weatherResult template with the weather data
  } catch (error) {
    console.error(error);

    res.render("search", {
      error: "Could not retrieve weather data, please try again.",
    });
  }
});

// Route to add a location to the user's favorites
app.post("/favorites/add", async (req, res, next) => {
  const userId = req.user._id;
  const { location } = req.body;

  if (!location) {
    return next(new ExpressError("Location is required", 400));
  }

  try {
    const user = await User.findById(userId);
    if (!user.favorites.includes(location)) {
      user.favorites.push(location);

      await user.save();

      res.status(200).send("Location added to favorites successfully");
    } else {
      return next(
        new ExpressError("Location already exists in favorites", 400),
      );
    }
  } catch (error) {
    console.log(error);
    return next(
      new ExpressError(
        "A server error occurred while adding the location to favorites.",
        500,
      ),
    );
  }
});

// Route to remove a location from the user's favorites
app.post("/favorites/remove", async (req, res, next) => {
  const userId = req.user._id;
  const location = req.body.location;

  try {
    const user = await User.findById(userId);

    // Check if the location exists in the array before removal
    if (!user.favorites.includes(location)) {
      console.log("Location not found in favorites:", location);
      return next(new ExpressError("Location not found in favorites", 400));
    }

    // Remove the location from the favorites array and save the user document to the database
    await User.updateOne({ _id: userId }, { $pull: { favorites: location } });

    res.status(200).send("Location removed from favorites successfully");
  } catch (err) {
    console.error(err);
    return next(
      new ExpressError(
        "A server error occurred while removing the location from favorites.",
        500,
      ),
    );
  }
});

// Route to render the register page
app.get("/register", (req, res) => {
  res.render("user/register");
});

// Route to create a new user
app.post("/register", async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const user = new User({ email, username });
    const registeredUser = await User.register(user, password);
    req.login(registeredUser, (err) => {
      if (err) return next(err);
      // TODO: Flash a success message
      res.redirect("/");
    });
  } catch (error) {
    // TODO: Flash an error message
    res.render("register", { error: error.message });
  }
});

// Route to render the login page
app.get("/login", (req, res) => {
  res.render("user/login");
});

// Route to log in the user
app.post(
  "/login",
  passport.authenticate("local", {
    failureFlash: true,
    failureRedirect: "/login",
  }),
  (req, res) => {
    // TODO: Flash a success message
    const redirectUrl = res.locals.returnTo || "/"; // If returnTo is not set, redirect to base url
    delete res.locals.returnTo; // Delete the returnTo property from res.locals
    res.redirect(redirectUrl);
  },
);

// Route to log out the user
app.get("/logout", async (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

// Error handling middleware
app.all("*", (req, res, next) => {
  next(new ExpressError("Page Not Found", 404));
});

// Error handling middleware
app.use((err, req, res, next) => {
  const { statusCode = 500 } = err;
  if (!err.message) err.message = "Something went wrong.";
  if (req.xhr || req.headers.accept.indexOf("json") > -1) {
    // If the request is from AJAX, send a JSON response
    return res.status(statusCode).json({ message: err.message });
  } else {
    // For non-AJAX requests, render the error page
    res.status(statusCode).render("error", { err });
  }
});

const PORT = process.env.PORT || 3000;
// Start the server on the specified port and log a message to the console when the server is running successfully
app.listen(process.env.PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
