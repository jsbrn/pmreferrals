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

app.get('/', (request, response, next) => {

    database.get("carriers", {}, {}, -1, (carriers) => {

        var selectedCarriers = carriers.filter(c => c.id == (request.query.carrier ? request.query.carrier : "pm"));
        if (selectedCarriers.length == 0) { next(); return; }
        database.get("codes", {carrier: selectedCarriers[0].id}, {}, -1, (codes) => {
    
            codes.forEach(c => c.value = c.value.substring(0, 3));
            codes.sort((a, b) => { return Math.random() > (a.priority ? 0.9 : 0.5) ? 1 : -1; });

            response.render("home", {
                layout: "main.hbs",
                codes: utilities.chunkArray(codes, 3),
                redirect: request.query.redirect,
                bad_code: request.query.bad_code,
                successful_addition: request.query.success,
                carrier: selectedCarriers[0],
                carrier_options: carriers.map((elem) => { elem.selected = elem.id == selectedCarriers[0].id; return elem; }),
                empty: codes.length == 0
            });

        });

    });
    
});

app.get('/referral/:url', (request, response, next) => {

    database.get("codes", {url: request.params.url}, {}, 1, function (matching_codes) {
        if (matching_codes.length == 0) { next(); return; } //404
        var code = matching_codes[0];
        database.get("carriers", {id: code.carrier}, {}, -1, (carriers) => {
            if (carriers.length == 0) { next(); return; }
            var selectedCarrier = carriers[0];
            validator.findOnPage(selectedCarrier.activation_needle, selectedCarrier.activation_url.replace("{{code}}", code.value), (validator_results) => {  
                if (validator_results.error || !validator_results.valid) {
                    database.remove("codes", {url: request.params.url, carrier: code.carrier}, (deleted_codes) => {
                        database.insert("logs", [
                            {event_type: "delete", code: code.value, date: new Date()}
                        ], (inserted_logs) => {
                            response.redirect("/?carrier="+code.carrier+"&redirect=true&bad_code="+code.value);
                        });
                    }, (err) => {});
                } else {
                    database.insert("logs", [
                        {event_type: "view", code: code.value, date: new Date()}
                    ], (inserted_logs) => {
                        response.render("referral", {
                            layout: "main.hbs",
                            title: request.params.code,
                            url: carriers[0].activation_url.replace("{{code}}", code.value),
                            code: code
                        });
                    });
                }
            });
        });
    }, (err) => response.send(err));

});

app.get('/submit', (request, response, next) => {
    if (request.query.code && request.query.carrier) {
        database.get("carriers", {id: request.query.carrier}, {}, -1, (carriers) => {
            if (carriers.length == 0) { next(); return; }
            var selectedCarrier = carriers[0];
            validator.findOnPage(selectedCarrier.activation_needle, selectedCarrier.activation_url.replace("{{code}}", request.query.code), (validator_results) => {
                if (validator_results.error || !validator_results.valid) {
                    response.redirect("/submit?invalid=true&bad_code="+request.query.code+"&carrier="+selectedCarrier.id);
                    return;
                } 
                database.get("codes", {value: request.query.code, carrier: selectedCarrier.id}, {}, 1, (results) => {
                    if (results.length > 0) {
                        response.redirect("/submit?exists=true&bad_code="+request.query.code+"&carrier="+selectedCarrier.id);
                    } else {
                        database.insert("codes", [
                            {
                                value: request.query.code, 
                                priority: false, 
                                url:  Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
                                carrier: selectedCarrier.id
                            }
                        ], (inserted_codes) => {
                            database.insert("logs", [
                                {event_type: "submit", code: request.query.code, date: new Date()}
                            ], (results) => {
                                response.redirect("/?success=true&carrier="+selectedCarrier.id);
                            });
                        }, (err) => {});
                    }
                }, (err) => response.send(err));
            });
        });
    } else {
        database.get("carriers", {}, {}, -1, (carriers) => {
            response.render("submit", {
                layout: "main.hbs",
                title: "Submit your code",
                invalid: request.query.invalid,
                exists: request.query.exists,
                bad_code: request.query.bad_code,
                carrier_options: carriers.map((elem) => { elem.selected = elem.id == request.query.carrier; return elem; })
            });
        });
    }
    
});

app.get('/faq', (request, response) => {
    response.render("faq", {
        layout: "main.hbs",
        title: "FAQ"
    });
});

//catchall and 404
app.get('*', (request, response) => {
    response.render("404", {
        layout: "main.hbs",
        title: "Not found"
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