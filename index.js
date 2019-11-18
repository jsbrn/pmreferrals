require('dotenv').config() //load the environment variables

const path = require('path');
//load express
const express = require('express')
const app = express()
const exphbs = require('express-handlebars');
const database = require('./app/database.js');
const cleanup = require('./app/cleanup.js');
const utilities = require('./app/utilities.js');
const mailer = require('./app/mailer.js');
const validator = require('./app/validator.js');

/*Set the Handlebars options, including the Helpers*/
app.engine('.hbs', exphbs({
      defaultLayout: 'main',
      extname: '.hbs',
      layoutsDir: path.join(__dirname, 'views/layouts'),
      helpers: {}
}));
app.set('view engine', '.hbs');
app.set('views', path.join(__dirname, 'views'));

/*Set locations for getting static content*/
app.use('/assets',express.static(path.join(__dirname, 'views/assets')));
app.use('/images',express.static(path.join(__dirname, 'views/assets/images')));
app.use('/css',express.static(path.join(__dirname, 'views/assets/stylesheets')));
app.use('/scripts',express.static(path.join(__dirname, 'views/assets/scripts')));

/*HTTP REQUEST HANDLERS*/

//post all requests to the console
app.all("*", (request, response, next) => {
    console.log(request.method, request.url, request.params, request.query, request.body);
    next();
});

app.get('/', (request, response) => {

    database.get("codes", {visible: true}, {verified: -1}, -1, (codes) => {

        var verified = codes.filter((c) => { return c.verified; });
        var unverified = codes.filter((c) => { return !c.verified; });
        verified.forEach(c => c.value = c.value.substring(0, 3));
        unverified.forEach(c => c.value = c.value.substring(0, 3));

        verified.sort((a, b) => { return Math.random() > 0.5 ? 1 : -1; });
        unverified.sort((a, b) => { return Math.random() > 0.5 ? 1 : -1; });

        response.render("home", {
            layout: "main.hbs",
            verified: utilities.chunkArray(verified, 3),
            unverified: utilities.chunkArray(unverified, 3)
        });
    }, (error) => { 
        response.send("An error has occurred. Please send an email to contact@pmreferrals.ca."); 
        console.log(error);
    });
    
});

app.get('/faq', (request, response) => {
    response.render("faq", {
        layout: "main.hbs",
        title: "FAQ"
    });
});

app.get('/success', (request, response) => {
    response.render("success", {
        layout: "main.hbs",
        title: "Referral sent"
    });
});

app.get('/api/verify/:code', (request, response) => {
    validator.isValidReferral(request.params.code, (result) => {
        response.json(result);
    });
});

//catchall and 404
app.get('*', (request, response) => {
    response.render("404", {
        layout: "main"
    });
});

/*LAUNCH THE HTTP SERVER ON PORT 80*/
const port = 80;
app.listen(port, function(err) {
    if (err) console.log("An error occurred.");
    console.log("Server started on port "+port);
    database.connect();
    cleanup.register(function() { console.log("Terminating..."); database.disconnect(); });
});