const { body } = require('express-validator');

const registrationValidations = [
    body('username').notEmpty().trim().isString(),
    body('email').notEmpty().trim().isEmail(),
    body('first_name').notEmpty().trim().isString(),
    body('last_name').notEmpty().trim().isString(),
    body('password')
        .isString()
        .notEmpty()
        .trim()
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+}{":;'?/><.,[\]\\|~-]).*$/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one symbol'),
    body('accepts_marketing').notEmpty().isBoolean().toBoolean()
];

const authenticationValidations = [
    body('email').notEmpty().trim().isEmail(),
    body('password').notEmpty().trim().isString(),
]

const newPasswordValidator = [
    body('newPassword')
        .isString()
        .notEmpty()
        .trim()
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+}{":;'?/><.,[\]\\|~-]).*$/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one symbol'),
]

module.exports = {
    registrationValidations,
    authenticationValidations,
    newPasswordValidator
}
