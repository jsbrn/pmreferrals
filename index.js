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
const moment = require('moment');
var Cookies = require('cookies');
const bodyParser = require('body-parser');

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

app.use(express.json());

/*HTTP REQUEST HANDLERS*/

//post all requests to the console or redirect if maintenance
app.all("*", (request, response, next) => {
    console.log(request.method, request.url, request.params, request.query, request.body);
    if (process.env.MAINTENANCE=="true") {
        response.render("maintenance", {
            layout: "noheader.hbs",
            message: process.env.MESSAGE,
            submessage: process.env.SUBMESSAGE
        })
    } else {
        //fetch the sessionId cookie
        var cookies = new Cookies(request, response);
        var sessionId = cookies.get("userSessionId");
        request.sessionId = sessionId;
        next();
    }
});

app.get('/', (request, response, next) => {
    database.get("accounts", {}, {lastBoost: -1}, 5, (accounts) => {


        accounts.forEach(c => c.code = c.code.substring(0, 3));
        accounts.sort((a, b) => { return Math.random() > 0.5 });

        response.render("home", {
            layout: "main.hbs",
            loggedIn: request.sessionId != undefined && request.sessionId.length > 0,
            accounts: accounts,
            bad_code: request.query.bad_code,
            successful_addition: request.query.success,
            empty: accounts.length == 0
        });

    });
});

app.get("/account", (request, response, next) => {
    database.get("accounts", {session: request.sessionId}, {}, 1, (results) => {
        if (results.length == 0) {
            //user not logged in
            response.redirect("/login");
        } else {
            response.render("account", {
                layout: "main.hbs",
                account: results[0]
            });
        }
    }, (error) => {response.send(500);});
});

app.get('/referral/:url', (request, response, next) => {

    database.get("codes", {url: request.params.url}, {}, 1, function (matching_codes) {
        if (matching_codes.length == 0) { next(); return; } //404
        var code = matching_codes[0];
        validator.verifyCode(code.value, (validator_results) => {  
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
    }, (err) => response.send(err));

});

app.get("/login", (request, response) => {
    response.render("login", {
        layout: "main.hbs"
    });
});


app.get("/register", (request, response) => {
    response.render("register", {
        layout: "main.hbs"
    });
});

app.get('/faq', (request, response) => {
    response.render("faq", {
        layout: "main.hbs",
        title: "FAQ"
    });
});

app.get('/stats', (request, response) => {
    database.get('logs', {}, {}, -1, (logs) => {

        var totalViewCount = logs.filter((l) => { 
            return l.event_type === "view" 
                && l.date < moment().subtract(1, 'hour');
        }).length;
        var weeklyViewCount = logs.filter((l) => { 
            return l.event_type === "view" 
                && l.date < moment().subtract(1, 'hour')
                && l.date > moment().subtract(7, 'days');
        }).length;
        var dailyViewCount = logs.filter((l) => { 
            return l.event_type === "view" 
                && l.date < moment().subtract(1, 'hour')
                && l.date > moment().subtract(1, 'day');
        }).length;

        var viewCounts = new Array();
        var submissionCounts = new Array();
        var dayLabels = new Array();
        
        var days = request.query.days ? parseInt(request.query.days) : 14;

        if (days > 180) {
            response.redirect("/statistics?days=180");
            return;
        }

        for (var d = moment('2019-11-18'); d.isBefore(moment()); d.add(1, 'day')) {
            viewCounts.push(
                logs.filter((l) => {
                    return l.event_type === "view"
                    && l.date < moment().subtract(1, 'hour')
                    && d.isSame(l.date, 'day')
                }).length
            );
            submissionCounts.push(
                logs.filter((l) => {
                    return l.event_type === "submit"
                    && l.date < moment().subtract(1, 'hour') 
                    && d.isSame(l.date, 'day')
                }).length
            );
            dayLabels.push(
                d.format("YYYY-MM-DD")
            );
        }

        response.render("stats", {
            layout: "main.hbs",
            title: "Statistics",
            days: days,
            totalViewCount: totalViewCount,
            weeklyViewCount: weeklyViewCount,
            dailyViewCount: dailyViewCount,
            dailyViewsHot: dailyViewCount > 20,
            weeklyViewsHot: weeklyViewCount > 200,
            chartData: {
                "labels": dayLabels,
                "views": viewCounts,
                "submissions": submissionCounts
            }
        });

    });
});

app.get('/logout', (request, response) => {
    var cookies = new Cookies(request, response);
    cookies.set("userSessionId", "");
    response.redirect("/");
});

app.post('/register', (request, response, next) => {
    var cookies = new Cookies(request, response);
    console.log(request.body);
    database.get("accounts", {username: request.body.username, code: request.body.code}, {}, 1, (results) => {
        if (results.length == 0) {
            validator.verifyCode(request.body.code, (validator_results) => {
                if (!validator_results.valid) {
                    response.json({success: false, reason: "The code "+request.body.code+" is not valid."});
                    return;
                } else if (validator_results.error) {
                    response.json({success: false, reason: "An unknown error occured."});
                } else {
                    var sessionId = "X"+Math.floor((Math.random() * 100000000));
                    database.insert("accounts", [{
                        username: request.body.username,
                        password: request.body.password,
                        code: request.body.code,
                        boostPoints: 0,
                        lastBoost: new Date(),
                        boostCooldown: 0,
                        session: sessionId
                    }], (results) => {
                        cookies.set("userSessionId", sessionId);
                        response.json({success: true});
                    })
                }
            });  
        } else {
            response.json({success:false, reason: "Username already exists!"});
        }
    }, (err) => response.json({success:false, reason: "Database error"}));
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