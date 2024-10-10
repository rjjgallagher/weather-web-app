const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true
    }
});
/*
 The passport-local-mongoose plugin simplifies the integration of Passport.js
 for local authentication by adding the following functionalities:
 - Automatically adds username and password fields to the schema.
 - Hashes and salts the password before storing it in the database.
 - Provides methods for authenticating the user, such as `authenticate`, `register`, and `createStrategy`.
 - Ensures that the username is unique.
 - Supports additional options for customizing the behavior of the plugin.
 */
UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', UserSchema);