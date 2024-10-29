if (process.env.NODE_ENV !== "production") {
  require("dotenv").config(); // Load environment variables
}

const express = require("express");
const path = require("path");
const methodOverride = require("method-override");
const engine = require("ejs-mate");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user");
const Weather = require("./models/weather");
const ExpressError = require("./utils/ExpressError");
const {
  checkAndUpdateStaleWeatherData,
  getWeatherData,
} = require("./utils/weatherHelpers.js");

const db_Url = process.env.DB_URL || "mongodb://127.0.0.1:27017/weather-app";
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
  // If the user is not authenticated, redirect to the login page
  if (!req.isAuthenticated()) {
    req.session.returnTo = req.originalUrl; // Store the original URL in the session
    // TODO: Flash an error message
    return res.redirect("/login");
  }
  next();
};

// Middleware to set the currentUser variable in the response locals object
const setCurrentUser = (req, res, next) => {
  res.locals.currentUser = req.user; // Set the currentUser variable in the response locals
  next();
};

// Middleware to store the returnTo path from the session
const storeReturnTo = (req, res, next) => {
  if (req.session.returnTo) {
    res.locals.returnTo = req.session.returnTo;
  }
  next();
};

app.use(setCurrentUser);

// Route to render the search page
app.get("/", (req, res) => {
  res.render("search");
});

// Route to retrieve weather data from the database
app.get("/api/weather", async (req, res, next) => {
  const { location } = req.query;

  if (!location) {
    return next(new ExpressError("Location is required", 400));
  }

  try {
    // Query the database for the weather data of the specified location
    const weatherData = await getWeatherData(location);

    if (!weatherData) {
      return next(
        new ExpressError("Weather data not found in the database.", 404)
      );
    }

    // Send the found weather data as a JSON response
    res.status(200).json(weatherData);
  } catch (error) {
    console.error("Error retrieving weather data:", error);
    next(new ExpressError("Failed to retrieve weather data.", 500));
  }
});

// Route to render the dashboard page with weather data for favorite locations
app.get("/dashboard", isLoggedIn, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate("favorites");

    const lastSearchedLocation = req.session.lastSearchedLocation;
    const defaultLocation = user.favorites[0].location ? user.favorites[0].location : "Minneapolis";
    const weatherData = lastSearchedLocation
      ? await getWeatherData(lastSearchedLocation)
      : await getWeatherData(defaultLocation);

    if (!weatherData || weatherData.length === 0) {
      // Render the dashboard with an appropriate message instead of throwing an error
      return res.render("dashboard", {
        weatherData: null,
        message:
          "No weather data available for your favorite locations. Please try again later or add new favorites.",
      });
    }
    res.render("dashboard", { weatherData, favorites: user.favorites }); // Render the dashboard page with the weather data
  } catch (error) {
    console.error(
      "\nError Code: 500\nError fetching weather data for dashboard:\n",
      error
    );
    next(
      new ExpressError(
        "\nError Code: 500\nFailed to load weather data for your dashboard.\n",
        500
      )
    );
  }
});

// Route to search for weather data
app.get("/search", async (req, res, next) => {
  const location = req.query.location; // Extract city from form submission
  try {
    // Use getWeatherData to either retrieve cached data or fetch new data
    const weatherData = await getWeatherData(location);
    if (!weatherData) {
      return next(
        new ExpressError(
          "Could not retrieve weather data, please try again.",
          400
        )
      );
    }
    req.session.lastSearchedLocation = location; // Store the last searched location in the session
    // Render the weatherResult template with the weather data and location
    res.render("weatherResult", { weatherData, location });
  } catch (error) {
    console.error("Error in /search route:\n", error);
    next(
      new ExpressError(
        "Failed to retrieve weather data, please try again.",
        500
      )
    );
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
    const user = await User.findById(userId).populate("favorites");

    // Find the weather data for the location
    let weather = await Weather.findOne({ location });

    if (!weather) {
      console.log(
        "No weather data found in the database. Fetching from API..."
      );
      await checkAndUpdateStaleWeatherData([location]);
      weather = await Weather.findOne({ location });
      console.log("Weather data fetched from API:", weather);
      if (!weather)
        return next(
          new ExpressError("Location not found in the database or API.", 400)
        );
    }

    // Check if the weather data's ObjectId is already in the user's favorites
    const alreadyInFavorites = user.favorites.some((fav) =>
      fav._id.equals(weather._id)
    );

    if (!alreadyInFavorites) {
      user.favorites.push(weather._id); // Add the ObjectId of the weather data to the user's favorites
      await user.save(); // Save the user's favorites
      return res
        .status(200)
        .json({ message: "Location added to favorites successfully." }); // Send a success response
    } else {
      return next(new ExpressError("Location already in favorites.", 400)); // Send a bad request response
    }
  } catch (error) {
    console.error("Error within /favorites/add route\n", error);
    next(
      new ExpressError(
        "A server error occurred while adding the location to favorites.",
        500
      )
    );
  }
});

// Route to remove a location from the user's favorites
app.post("/favorites/remove", async (req, res, next) => {
  const userId = req.user._id;
  const { location } = req.body;

  if (!location) {
    return next(new ExpressError("Location is required", 400));
  }

  try {
    const user = await User.findById(userId);

    // Find the weather data for the location
    const weather = await Weather.findOne({ location });

    if (!weather) {
      return next(new ExpressError("Location not found", 400));
    }

    // Check if the weather data's ObjectId is in the user's favorites
    const weatherIndex = user.favorites.findIndex((fav) =>
      fav.equals(weather._id)
    );

    if (weatherIndex === -1) {
      return next(new ExpressError("Location not found in favorites", 400));
    }

    // Remove the ObjectId of the weather data from the user's favorites
    user.favorites.splice(weatherIndex, 1);
    await user.save();

    return next(
      new ExpressError("Location removed from favorites successfully")
    );
  } catch (err) {
    console.error("Error removing favorite location:", err);
    next(
      new ExpressError(
        "A server error occurred while removing the location from favorites.",
        500
      )
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
  storeReturnTo,
  passport.authenticate("local", {
    failureFlash: true,
    failureRedirect: "/login",
  }),
  (req, res) => {
    // TODO: Flash a success message
    const redirectUrl = res.locals.returnTo || "/"; // If returnTo is not set, redirect to base url
    delete res.locals.returnTo; // Delete the returnTo property from res.locals
    res.redirect(redirectUrl);
  }
);

// Route to log out the user
app.get("/logout", async (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    delete req.session.lastSearchedLocation;
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