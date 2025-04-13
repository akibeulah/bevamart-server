const User = require("../models/User")
const {defaultResponse} = require("../utils/requestHelper")
const jwt = require("jsonwebtoken");
const {validationResult} = require('express-validator');
const fs = require("fs");
const TssMailer = require("./mailerService");
const {newUserWelcomeEmailSubject} = require("../mailer/emailString");
const {capitalize} = require("../utils/utils");

const CreateCustomer = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
        return defaultResponse(res, [400, "Please check your information", errors.array()]);

    const {username, email, first_name, last_name, password, accepts_marketing} = req.body
    const existingUser = await User.findOne({$or: [{email: username}, {username: username}]});

    if (existingUser)
        return defaultResponse(res, [400, "User already exists", ""])

    try {
        const newUser = new User({username, email, first_name, last_name, password, accepts_marketing})
        await newUser.save()

        const htmlFile = fs.readFileSync(
            "./mailer/emailTemplates/newUserWelcomeEmailTemplate.html",
            'utf-8'
        )

        const processedHtml = htmlFile
            .replace(/{{first_name}}/g, `${capitalize(newUser.first_name)}`)
            .replace(/{{last_name}}/g, `${capitalize(newUser.last_name)}`)
        TssMailer(email, newUserWelcomeEmailSubject, "", processedHtml)

        return defaultResponse(res, [200, "User created successfully", ""])
    } catch (error) {
        console.log(error)
        return defaultResponse(res, [500, "Oops, something went wrong", error])
    }
}

const AuthenticateUser = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
        return defaultResponse(res, [400, "Please check your information", errors.array()]);

    const existingUser = await User.findOne({$or: [{email: req.body.email}, {username: req.body.email}]});

    if (!existingUser)
        return defaultResponse(res, [400, "User does not exist", ""])

    const checkPassword = await existingUser.comparePassword(req.body.password);

    if (!checkPassword)
        return defaultResponse(res, [400, "Password is incorrect", ""])

    const token = jwt.sign(
        {
            email: existingUser.email,
            id: existingUser._id
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "1day"
        }
    );
    return defaultResponse(res, [200, "✅ Login Successful", {token: token, user_details: existingUser}])
}

module.exports = {CreateCustomer, AuthenticateUser}