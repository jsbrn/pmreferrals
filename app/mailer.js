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
    host: process.env.SMTP_SERVER,
    port: process.env.SMTP_PORT,
    secure: true, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_ADDRESS,
        pass: process.env.EMAIL_PASSWORD
    }
});
transporter.use('compile', hbs(options));

function sendTemplate(to, subject, template, context, callback) {
    context.root = process.env.BASE_URL; //add the base url (external url) so email links work properly
    if (!context.tries) context.tries = 1;
    transporter.sendMail({
        from: "PMReferrals.ca <noreply@pmreferrals.ca>",
        to: to,
        subject: subject,
        template: template,
        context: context
    }, (error, info) => {
        if (error && context.tries < 25) { //try up to 25 times to send
            console.log(error.message);
            console.log("tries = "+context.tries);
            context.tries++;
            sendTemplate(to, subject, template, context, callback);
        } else {
            callback(info);
        }
    });
}

function sendHTML(to, subject, html, callback) {
    sendTemplate(to, subject, "html", {html: html}, callback);
}

function sendRaw(to, subject, text, callback) {
    sendTemplate(to, subject, "raw", {text: text}, callback);
}

module.exports.sendTemplate = sendTemplate;
module.exports.sendHTML = sendHTML;
module.exports.sendRaw = sendRaw;