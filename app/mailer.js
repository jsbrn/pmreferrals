const nodemailer = require('nodemailer');

console.log(process.env.EMAIL_ADDRESS+" email");

// create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
    host: 'mail.privateemail.com',
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_ADDRESS,
        pass: process.env.EMAIL_PASSWORD
    }
});

function send(to, subject, html, callback) {
    sendMail({
        from: 'PMReferrals.ca <noreply@pmreferrals.ca>', // sender address
        to: to, // list of receivers
        subject: subject, // Subject line
        html: html // html body
    }, callback);
}

function sendMail(mail, callback) {
    transporter.sendMail(mail, callback);
}

module.exports.send = send;