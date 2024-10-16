const mongoose = require("mongoose");
const User = require("../models/user");

const db_Url = process.env.DB_URL || "mongodb://127.0.0.1:27017/weather-app";
mongoose.connect(db_Url);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("Database connected");
});

const seedDB = async () => {
  try {
    const user = await User.findById("6705f26c8e8522a1c738146e");
    user.favorites = []; // Clear the favorites array
    await user.save();
    console.log(`Removed favorites for user: ${user.username}`);
  } catch (error) {
    console.error(error);
  }
};

seedDB().then(() => {
  mongoose.connection.close();
});
