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
const hasher = require('password-hash');
const moment = require('moment');
var Cookies = require('cookies');
var Fingerprint = require('express-fingerprint');
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
app.set('trust proxy', true);

/*Set locations for getting static content*/
app.use('/assets',express.static(path.join(__dirname, 'views/assets')));
app.use('/images',express.static(path.join(__dirname, 'views/assets/images')));
app.use('/css',express.static(path.join(__dirname, 'views/assets/stylesheets')));
app.use('/scripts',express.static(path.join(__dirname, 'views/assets/scripts')));

//fingerprint the visitor
app.use(Fingerprint({
    parameters:[
        // Defaults
        Fingerprint.useragent,
        Fingerprint.acceptHeaders,
        Fingerprint.geoip
    ]
}))

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
        request.loggedIn = request.sessionId != undefined && request.sessionId.length > 0;
        next();
    }
});

//verify that the fingerprint has not been seen before
//and record any unique fingerprints found
app.get("*", (request, response, next) => {
    request.ip = request.header('x-forwarded-for') || request.connection.remoteAddress;
    var cookies = new Cookies(request, response);
    request.hasFingerprintCookie = cookies.get("fingerprintHash") != undefined;
    request.hasSessionCookie = cookies.get("userSessionId") != undefined;
    database.get("fingerprints", {ip: request.ip}, {}, -1, (results1) => {
        request.seenIPBefore = results1.length > 0;
        database.get("fingerprints", {hash: request.fingerprint.hash}, {}, -1, (results2) => {
            request.seenFingerprintBefore = results2.length > 0;
            request.seenBefore = 
                request.hasFingerprintCookie 
                || request.hasSessionCookie
                || request.seenIPBefore
                || (request.seenIPBefore && request.seenFingerprintBefore);
            if (!request.seenFingerprintBefore || !request.seenIPBefore) 
                database.insert("fingerprints", [{ip: request.ip, hash: request.fingerprint.hash}], (insertion) => {}, (error) => {});
            cookies.set("fingerprintHash", request.fingerprint.hash, {expires: new Date('2050')});
            next();
        }, (error) => {});
    }, (error) => { next(); });
});

//fingerprint debugging tool :)
app.get("/debug/fp", (request, response) => {
    request.fingerprint.seenBefore = request.seenBefore;
    request.fingerprint.hasFingerprintCookie = request.hasFingerprintCookie;
    request.fingerprint.hasSessionCookie = request.hasSessionCookie;
    request.fingerprint.seenIPBefore = request.seenIPBefore;
    request.fingerprint.seenFingerprintBefore = request.seenFingerprintBefore;
    response.json(request.fingerprint);
});

//ip debugging tool
app.get("/debug/ip", (request, response) => {
    response.send(request.ip);
});

//reset account scores once each week
app.all("*", (request, response, next) => {
    var week = moment().week();
    database.get("meta", {lastWeekReset: week}, {}, -1, (results) => {
        if (results.length == 0) {
            //no record of resetting this week, so time to reset
            console.log("Time to reset scores (week "+week+")");
            database.update("accounts", {}, {boostPoints: 0}, (results) => {
                database.update("meta", {}, {lastWeekReset: week}, (results) => {}, (error) => {});
                next();
            }, (error) => {});
        } else { next(); }
    }, (error) => {});
});

app.get('/', (request, response, next) => {
    database.get("accounts", {disabled: false}, {boostPoints: -1, lastBoost: -1}, 10, (accounts) => {
        accounts.forEach(c => c.code = c.code.substring(0, 3));
        response.render("home", {
            layout: "main.hbs",
            loggedIn: request.loggedIn,
            seenBefore: request.seenBefore,
            accounts: accounts,
            bad_code: request.query.bad_code,
            successful_addition: request.query.success,
            empty: accounts.length == 0
        });

    });
});

app.get("/account", (request, response, next) => {
    database.get("accounts", {}, {boostPoints: -1, lastBoost: -1}, -1, (results) => {
        var index = results.findIndex(account => account.session === request.sessionId);
        if (index == -1) {
            //user not logged in
            response.redirect("/login");
        } else {
            response.render("account", {
                layout: "main.hbs",
                loggedIn: request.loggedIn,
                account: results[index],
                rank: results[index].disabled ? '-' : index + 1,
                totalAccounts: results.filter(a => !a.disabled).length,
                boostAllowed: results[index].lastBoost < moment().subtract(results[index].boostCooldown, "hours"),
                cooldownRemaining: Math.ceil(moment.duration(
                    moment(results[index].lastBoost).add(results[index].boostCooldown, "hours").diff(moment())).asHours())
            });
        }
    }, (error) => {response.send(500);});
});

app.get('/referral/:url', (request, response, next) => {
    database.get("accounts", {url: request.params.url}, {}, 1, function (matching_accounts) {
        if (matching_accounts.length == 0) { next(); return; } //404
        var account = matching_accounts[0];
        if (!request.loggedIn) database.insert("logs", [{event_type: "view", code: account.code, date: new Date()}], (inserted_logs) => {});
        response.render("referral", {
            layout: "main.hbs",
            loggedIn: request.loggedIn,
            title: account.code,
            url: "https://activate.publicmobile.ca/?raf="+account.code,
            code: account.code
        });
    }, (err) => response.send(err));
});

app.get("/login", (request, response) => {
    response.render("login", {
        layout: "main.hbs",
        title: "Login"
    });
});

app.get("/privacy", (request, response) => {
    response.render("privacy", {
        layout: "main.hbs",
        title: "Privacy Statement",
        loggedIn: request.loggedIn
    });
});

app.get("/register", (request, response) => {
    response.render("register", {
        layout: "main.hbs",
        title: "Submit your code"
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
        var deletionCounts = new Array();
        var submissionCounts = new Array();
        var shareCounts = new Array();
        var boostCounts = new Array();
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
            boostCounts.push(
                logs.filter((l) => {
                    return l.event_type === "boost"
                    //&& l.date < moment().subtract(1, 'hour')
                    && d.isSame(l.date, 'day')
                }).length
            );
            shareCounts.push(
                logs.filter((l) => {
                    return l.event_type === "share"
                    //&& l.date < moment().subtract(1, 'hour')
                    && d.isSame(l.date, 'day')
                }).length
            );
            deletionCounts.push(
                logs.filter((l) => {
                    return l.event_type === "delete"
                    //&& l.date < moment().subtract(1, 'hour')
                    && d.isSame(l.date, 'day')
                }).length
            );
            submissionCounts.push(
                logs.filter((l) => {
                    return l.event_type === "submit"
                    //&& l.date < moment().subtract(1, 'hour') 
                    && d.isSame(l.date, 'day')
                }).length
            );
            dayLabels.push(
                d.format("YYYY-MM-DD")
            );
        }

        response.render("stats", {
            layout: "main.hbs",
            loggedIn: request.loggedIn,
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
                "submissions": submissionCounts,
                "boosts": boostCounts,
                "deletions": deletionCounts,
                "shares": shareCounts
            }
        });

    });
});

app.get("/account/delete", (request, response) => {
    database.get("accounts", {session: request.sessionId}, {}, -1, (results) => {
        if (results.length == 0) return;
        database.remove("accounts", {session: request.sessionId}, (deleted) => {
            database.insert("logs", [{
                event_type: "delete",
                code: results[0].code,
                date: new Date()
            }], (results) => {
                var cookies = new Cookies(request, response);
                cookies.set("userSessionId", "");
                response.redirect("/");
            }, (error) => {});
        }, (error) => {});
    }, (error) => {});
});

app.get('/logout', (request, response) => {
    var cookies = new Cookies(request, response);
    cookies.set("userSessionId", "");
    response.redirect("/");
});

app.post("/boost", (request, response) => {
    database.get("accounts", {session: request.sessionId}, {}, 1, (results) => {
        if (results.length > 0) {
            if (results[0].lastBoost < moment().subtract(results[0].boostCooldown, 'hours')) {
                database.update("accounts", {session: request.sessionId}, { 
                    lastBoost: new Date(),
                    boostPoints: results[0].boostPoints + 1,
                    boostCooldown: 10 + (Math.random() * 4)
                }, (updated) => {
                    database.insert("logs", [{
                        event_type: "boost",
                        code: results[0].code,
                        date: new Date()
                    }], (inserted) => {

                    }, (error) => {});
                    response.json({success: true});
                }, (error) => {response.json({success: false, reason: "Database error"})});
            } else {
                response.json({success: false, reason: "You're doing that too much."});
            }
        } else {
            response.json({success:false, reason: "Incorrect username or password!"});
        }
    }, (err) => response.json({success:false, reason: "Database error"}));
});

app.post('/login', (request, response, next) => {
    var cookies = new Cookies(request, response);
    database.get("accounts", {username: request.body.username}, {}, 1, (results) => {
        if (results.length > 0 && hasher.verify(request.body.password, results[0].password)) {
            validator.verifyCode(results[0].code, (validator_results) => {
                var sessionId = "X"+Math.floor((Math.random() * 100000000));
                database.update("accounts", {username: request.body.username}, {
                    session: sessionId,
                    disabled: !validator_results.valid && !validator_results.error,
                }, (results) => {
                    cookies.set("userSessionId", sessionId, {maxAge: 1000*60*60*24*7});
                    response.json({success: true});
                }, (error) => {response.json({success: false, reason: "Database error"})});
                });
        } else {
            response.json({success:false, reason: "Incorrect username or password!"});
        }
    }, (err) => response.json({success:false, reason: "Database error"}));
});

app.post('/register', (request, response, next) => {
    var cookies = new Cookies(request, response);

    if (!request.body.password || !request.body.username || !request.body.code) {
        response.json({success:false,reason:"Looks like you're missing something."});
        return;
    }

    request.body.code = request.body.code.trim().toUpperCase();

    if (request.body.password.length < 6) {
        response.json({success:false,reason:"Your password must be at least 6 characters long."});
        return;
    }

    if (request.body.username.length < 4 || request.body.username.length > 32) {
        response.json({success:false,reason:"Your username must be between 4 and 32 characters long."});
        return;
    }

    var usernameCheck = /([A-Za-z0-9])+/.exec(request.body.username);
    var validUsername = usernameCheck != null && usernameCheck.includes(request.body.username);
    var passwordCheck = /([^\s])*/.exec(request.body.password);
    var validPassword = passwordCheck != null && passwordCheck.includes(request.body.password);
    if (!validUsername) {
        response.json({success:false,reason:"Usernames can only have letters and numbers."});
        return;
    }
    if (!validPassword) {
        response.json({success:false,reason:"Passwords cannot have whitespace."});
        return;
    }
    if (request.body.username.toUpperCase() === request.body.code) {
        response.json({success:false,reason:"Your username cannot be your referral code."});
        return;
    }

    database.get("accounts", {$or: [{code: request.body.code}, {username: request.body.username}]}, {}, -1, (results) => {
        if (results.length == 0) {
            validator.verifyCode(request.body.code, (validator_results) => {
                console.log(validator_results);
                if (!validator_results.valid) {
                    response.json({success: false, reason: request.body.code+" is not a valid referral code."});
                    return;
                } else if (validator_results.error) {
                    response.json({success: false, reason: "Failed to contact the verification server."});
                } else {
                    var sessionId = "X"+Math.floor((Math.random() * 100000000));
                    database.insert("accounts", [{
                        username: request.body.username,
                        password: hasher.generate(request.body.password),
                        code: request.body.code,
                        url: [...Array(5).keys()]
                                .map(e => String.fromCharCode(Math.floor(Math.random() * (122-97)) + 97))
                                .reduce((total, curr) => { return total+""+curr; }),
                        boostPoints: 0,
                        lastBoost: new Date(),
                        boostCooldown: 0,
                        session: sessionId,
                        disabled: false
                    }], (results) => {
                        database.insert("logs", [{
                            event_type: "submit",
                            code: request.body.code,
                            date: new Date()
                        }], (results) => {
                            cookies.set("userSessionId", sessionId);
                            response.json({success: true});
                        }, (error) => {});
                    })
                }
            });  
        } else {
            response.json({success:false, reason: results[0].username === request.body.username 
                ? "That username has been taken." 
                : "This code has been registered already."});
        }
    }, (err) => response.json({success:false, reason: "Database error"}));
});

//linkback program, match the url with the account to reward them for a successful share
app.get("/:accountURL", (request, response, next) => {
    database.get("accounts", {url: request.params.accountURL}, {}, -1, (results) => {
        if (results.length == 0) {
            next();
        } else {
            if (request.seenBefore) {
                response.redirect("/");
            } else {
                database.update("accounts", {url: request.params.accountURL}, {boostPoints: results[0].boostPoints + 2}, (updated) => {
                    database.insert("logs", [{
                        event_type: "share",
                        code: results[0].code,
                        date: new Date()
                    }], (results) => {
                        response.redirect("/");
                    }, (error) => {});
                }, (error) => {});
            }
        }
    }, (error) => { next(); });
});

//catchall and 404
app.get('*', (request, response) => {
    response.render("404", {
        layout: "main.hbs",
        loggedIn: request.loggedIn,
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