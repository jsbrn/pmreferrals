'use strict';
const nodemailer = require('nodemailer');

// create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
    host: 'smtp.sparkpostmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_ADDRESS, // generated ethereal user
        pass: "08d4c1c6489038f1b10eb23608c552fe5ff83b8a" // generated ethereal password
    }
});

function send(mail, callback) {
    transporter.sendMail(mail, callback);
}

module.exports.send = send;