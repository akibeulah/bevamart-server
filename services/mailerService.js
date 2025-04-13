const nodemailer = require('nodemailer');

const TssMailer = (to, subject, text, html) => {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: false,
            auth: {
                user: process.env.SMTP_USERNAME,
                pass: process.env.SMTP_PASSWORD
            }
        });

        const mailOptions = {
            from: process.env.SMTP_USERNAME,
            to: to,
            subject: subject,
            html: html
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error occurred:', error);
            } else {
                console.log('Email sent:', info.response);
            }
        });
    } catch (error) {
        console.log(error)
    }
}

module.exports = TssMailer