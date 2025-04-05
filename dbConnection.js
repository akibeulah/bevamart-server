const mongoose = require('mongoose');
require("dotenv").config()
const connection = process.env.MONGODB_CONNECTION_STRING;

mongoose.connect(connection, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}, console.log(`Database Connected Successfully`))
    .catch(err => console.log(err));