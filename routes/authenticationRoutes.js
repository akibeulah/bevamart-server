const express = require('express');
const { registrationValidations, authenticationValidations } = require('../validators/userValidators');
const { CreateCustomer, AuthenticateUser } = require('../services/authenticationService');
const router = express.Router();

router.post(
    '/authentication/register/',
    registrationValidations,
    CreateCustomer
);

router.post(
    '/authentication/login/',
    authenticationValidations,
     AuthenticateUser
);

module.exports = router;
