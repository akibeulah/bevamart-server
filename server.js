require("./dbConnection")
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors')
const dotenv = require("dotenv")
dotenv.config();

const apiV1Router = require('./routes');
const { defaultResponse } = require("./utils/requestHelper");

const app = express();
app.use(cors())
app.use(express.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use('/api/v1', apiV1Router);
app.use(express.static('public'));

const handleNotFound = (req, res) => {
    return defaultResponse(res, [404, "Sorry, this endpoint does not exist", ""])
};

const handleMethodNotAllowed = (req, res) => {
    return defaultResponse(res, [404, "Sorry, this method is not allowed for this endpoint", ""])
};

app.use(handleNotFound);
app.use(handleMethodNotAllowed);

const port = process.env.PORT || 5001;
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
