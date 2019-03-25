const nodemailer = require('nodemailer');

var hbs = require('nodemailer-express-handlebars');
var options = {
    viewEngine: {
        extname: '.hbs',
        layoutsDir: 'views/email'
    },
    viewPath: 'views/email',
    extName: '.hbs'
};

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
transporter.use('compile', hbs(options));

function sendTemplate(to, subject, template, context, callback) {
    context.root = process.env.ROOT_DIRECTORY; //assign a root URL so that external resources can be loaded in the email
    transporter.sendMail({
        from: "PMReferrals.ca <noreply@pmreferrals.ca>",
        to: to,
        subject: subject,
        template: template,
        context: context
    }, callback);
}

function sendHTML(to, subject, html, callback) {
    transporter.sendMail({
        from: 'PMReferrals.ca <noreply@pmreferrals.ca>', // sender address
        to: to, // list of receivers
        subject: subject, // Subject line
        html: html // html body
    }, callback);
}

function sendRaw(to, subject, text, callback) {
    transporter.sendMail({
        from: 'PMReferrals.ca <noreply@pmreferrals.ca>', // sender address
        to: to, // list of receivers
        subject: subject, // Subject line
        text: text // html body
    }, callback);
}

module.exports.sendTemplate = sendTemplate;
module.exports.sendHTML = sendHTML;
module.exports.sendRaw = sendRaw;