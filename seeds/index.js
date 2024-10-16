const mongoose = require("mongoose");

const db_Url = process.env.DB_URL || "mongodb://127.0.0.1:27017/weather-app";
mongoose.connect(db_Url);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("Database connected");
});

const sample = (array) => array[Math.floor(Math.random() * array.length)];

const seedDB = async () => {
  await Campground.deleteMany({});
  await Review.deleteMany({});
  for (let i = 0; i < 300; i++) {
    const random1000 = Math.floor(Math.random() * 1000);
    const price = Math.floor(Math.random() * 25) + 10;
    const camp = new Campground({});
    await camp.save();
  }
};

seedDB().then(() => {
  mongoose.connection.close();
});
