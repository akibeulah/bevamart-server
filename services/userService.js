const bcrypt = require('bcrypt');
const User = require("../models/User");
const Token = require("../models/Token");
const { defaultResponse } = require("../utils/requestHelper");
const otpGenerator = require('otp-generator');
const TssMailer = require('./mailerService');
const fs = require("fs");
const {newUserWelcomeEmailSubject, resetPasswordEmailSubject} = require("../mailer/emailString");
const {capitalize} = require("../utils/utils");

const fetchUserProfile = async (req, res, next) => {
    try {
        return defaultResponse(res, [200, "User fetched", req.user]);
    } catch (err) {
        return defaultResponse(res, [500, "Oops, something went wrong", { error: err }]);
    }
};

const updateUserDetails = async (req, res, next) => {
    try {
        const { username, first_name, last_name, accepts_marketing } = req.body;
        const existingUserWithNewUsername = await User.findOne({ username })
        if (existingUserWithNewUsername)
            return defaultResponse(res, [400, "Username already taken", null]);

        const updatedUser = await User.findByIdAndUpdate(req.user._id, { username, first_name, last_name, accepts_marketing }, { new: true });
        return defaultResponse(res, [200, "User details updated", updatedUser]);
    } catch (err) {
        return defaultResponse(res, [500, "Oops, something went wrong", { error: err }]);
    }
};

const updateUserEmail = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (email === req.user.email)
            return defaultResponse(res, [400, "You cannot use your current email", null]);

        req.user = await User.findByIdAndUpdate(req.user._id, {email: email, isEmailVerified: false}, {new: true})

        return await requestEmailVerification(req, res, next)
    } catch (err) {
        console.log(err)
        return defaultResponse(res, [500, "Oops, something went wrong", err]);
    }
};

const requestUserPasswordChange = async (req, res, next) => {
    try {
        const token = otpGenerator.generate(25, { upperCaseAlphabets: true, specialChars: false, numers: true });

        const expiration = new Date();
        expiration.setHours(expiration.getHours() + 5);
        const newToken = new Token({ owner: req.user, token: token, expiration: expiration, type: 'password_reset' })
        newToken.save()

        const htmlFile = fs.readFileSync(
            "./mailer/emailTemplates/resetPasswordEmailTemplate.html",
            'utf-8'
        )

        const processedHtml = htmlFile
            .replace(/{{first_name}}/g, `${capitalize(req.user.first_name)}`)
            .replace(/{{last_name}}/g, `${capitalize(req.user.last_name)}`)
            .replace(/{{reset_password_link}}/g, token);

        TssMailer(req.user.email, resetPasswordEmailSubject, "", processedHtml)

        return defaultResponse(res, [200, "Password reset email sent", null]);
    } catch (err) {
        return defaultResponse(res, [500, "Oops, something went wrong", { error: err }]);
    }
};

const updateUserPasswordAuthenticated = async (req, res, next) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const user = await User.findOne({ $or: [{ email: req.user.email }] });

        const checkNewPasswordIsNotNewPassword = await user.comparePassword(newPassword)
        if (checkNewPasswordIsNotNewPassword)
            return defaultResponse(res, [400, "You cannot use your old password", null]);

        const isPasswordCorrect = await user.comparePassword(oldPassword);
        if (!isPasswordCorrect) {
            return defaultResponse(res, [400, "Incorrect old password", null]);
        }

        user.password = newPassword;
        await user.save();

        return defaultResponse(res, [200, "Password updated successfully", null]);
    } catch (err) {
        console.log(err)
        return defaultResponse(res, [500, "Oops, something went wrong", { error: err }]);
    }
};

const updateUserPasswordToken = async (req, res, next) => {
    try {
        const token = await Token.findOne({ token: req.body.token })

        if (!token)
            return defaultResponse(res, [400, "Token not found", null]);

        if (token.type != 'password_reset')
            return defaultResponse(res, [400, "Token error", null]);

        if (new Date() > token.expiration)
            return defaultResponse(res, [400, "Token has expired", null]);

        const user = await User.findById(token.owner);

        if (!user)
            return defaultResponse(res, [400, "User not found", null]);

        user.password = req.body.newPassword
        await user.save()
        return defaultResponse(res, [200, "Password updated successfully", null]);
    } catch (err) {
        console.log(err)
        return defaultResponse(res, [500, "Oops, something went wrong", { error: err }]);
    }
};

const requestEmailVerification = async (req, res, next) => {
    try {
        const token = otpGenerator.generate(25, { upperCaseAlphabets: true, specialChars: false, numers: true });

        const expiration = new Date();
        expiration.setHours(expiration.getHours() + 24);
        const newToken = new Token({ owner: req.user, token: token, expiration: expiration, type: 'email_verification' })
        newToken.save()

        const message = `Hello ${req.user.username}, \nwe've recieved a request to verify your email. Please use the following link to do so:\n${token}`

        TssMailer(req.user.email, "Email Verification Request - 24 hour expiry", message)

        return defaultResponse(res, [200, "Email verification email sent", null]);
    } catch (err) {
        console.log(err)
        return defaultResponse(res, [500, "Oops, something went wrong", { error: err }]);
    }
};

const fetchAllAdmin = async (req, res, next) => {
    try {
        const admins = User.find({role: "admin"})

        return defaultResponse(res, [200, "Fetched admin users", admins]);
    } catch (error) {
        console.log(error)
    }
}

const fetchAllCustomers = async (req, res, next) => {
    try {
        const customers = User.find({role: "customer"})

        return defaultResponse(res, [200, "Fetched admin users", customers]);
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    fetchUserProfile,
    updateUserDetails,
    updateUserEmail,
    requestUserPasswordChange,
    updateUserPasswordAuthenticated,
    updateUserPasswordToken,
    requestEmailVerification
};
