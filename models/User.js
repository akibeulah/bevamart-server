const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const fs = require("fs");
const {capitalize} = require("../utils/utils");
const TssMailer = require("../services/mailerService");
const {resetPasswordEmailSubject, passwordResetSuccessfulNotificationEmailSubject} = require("../mailer/emailString");
const { Schema } = mongoose;

const userSchema = new Schema(
    {
        username: { type: String, required: true, unique: true },
        email: { type: String, required: true, unique: true },
        first_name: { type: String, required: true },
        last_name: { type: String, required: true },
        password: { type: String, required: true },
        accepts_marketing: { type: Boolean, required: true },
        isEmailVerified: { type: Boolean, default: false },
        role: { type: String, enum: ['customer', 'admin'], default: "customer" },
        state: { type: String, enum: ['enabled', 'disabled', 'deleted'], default: "enabled" }
    },
    {
        timestamps: true
    }
);


userSchema.pre('save', async function (next) {
    try {
        if (!this.isModified('password')) return next();


        const htmlFile = fs.readFileSync(
            "./mailer/emailTemplates/passwordResetSuccessNotificationEmailTemplate.html",
            'utf-8'
        )

        const processedHtml = htmlFile
            .replace(/{{first_name}}/g, `${capitalize(this.first_name)}`)
            .replace(/{{last_name}}/g, `${capitalize(this.last_name)}`)

        TssMailer(this.email, passwordResetSuccessfulNotificationEmailSubject, "", processedHtml)

        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
})

userSchema.methods.comparePassword = async function (password) {
    try {
        return await bcrypt.compare(password, this.password);
    } catch (error) {
        throw error;
    }
};

const User = mongoose.model('User', userSchema);

module.exports = User