require('dotenv').config() //load the environment variables

const path = require('path');
//load express
const express = require('express')
const app = express()
const exphbs = require('express-handlebars');
const database = require('./app/database.js');
//load mailer
const mailer = require('./app/mailer.js');
//load validator
const validator = require('./app/validator.js');
//if not running on Now instance, require dotenv
//(reads environment variables from a .env file on the local repo)


/*Set the Handlebars options, including the Helpers*/
app.engine('.hbs', exphbs({
      defaultLayout: 'main',
      extname: '.hbs',
      layoutsDir: path.join(__dirname, 'views/layouts'),
      helpers: {
          playerStatus: (player) => {
              console.log(JSON.stringify(player));
              var status = player.banned ? "banned" : (player.online ? "online" : "offline");
              status = status + (!player.member ? "-guest" : "");
              return status;
          },
          playerStatusDesc: (player) => {
                console.log(JSON.stringify(player));
                var status = (player.banned ? "Banned " : "") 
                    + (player.member ? "Member" : "Guest") 
                    + (player.online ? " (Online)" : " (Offline)");
                return status;
            },
          formatRep: (rep) => {
              return rep > 0 ? "green-bold" : "red-bold";
          }
      }
}));
app.set('view engine', '.hbs');
app.set('views', path.join(__dirname, 'views'));

/*Set locations for getting static content*/
app.use('/assets',express.static(path.join(__dirname, 'views/assets')));
app.use('/images',express.static(path.join(__dirname, 'views/assets/images')));
app.use('/css',express.static(path.join(__dirname, 'views/assets/stylesheets')));
app.use('/scripts',express.static(path.join(__dirname, 'views/assets/scripts')));
app.use('/audio',express.static(path.join(__dirname, 'views/assets/audio')));
app.use('/common',express.static(path.join(__dirname, 'app/common')));

/*HTTP REQUEST HANDLERS*/

//post all requests to the console
app.all("*", (request, response, next) => {
    console.log(request.method, request.url, request.params, request.query, request.body);
    next();
});

app.get('/', (request, response) => {
    database.get("accounts", {email_verified: true, phone_verified: true}, {}, -1, (accounts) => {
        database.get("requests", {}, {}, -1, (requests) => {
            response.render("home", {
                layout: "main.hbs",
                referral_count: accounts.length,
                usage_count: requests.length
            });
        }, (error) => { response.send("An error has occurred. Please send an email to contact@pmreferrals.ca."); });
    }, (error) => { response.send("An error has occurred. Please send an email to contact@pmreferrals.ca."); });
    
});

app.get('/join', (request, response) => {
    response.render("join", {
        layout: "main.hbs",
        title: "Register your number"
    });
});

app.get('/login', (request, response) => {
    response.render("login", {
        layout: "main.hbs",
        title: "View your account"
    });
});

app.get('/referral/:code?', (request, response, next) => {
    if (request.params.code) {
        database.get("accounts", {referral_code: request.params.code}, {}, -1, function(documents) {
            if (documents.length > 0) {
                response.render("referral", {
                    layout: "main.hbs",
                    title: "Get a referral",
                    referral_code: request.params.code
                });
            } else {
                next();
            }
        }, (error) => { response.sendStatus(502); });
    } else {
        response.render("referral", {
            layout: "main.hbs",
            title: "Get a referral",
            referral_code: request.params.code
        });
    }
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

app.get('/user/:id', (request, response, next) => {
    database.get("accounts", {id: request.params.id}, {}, 1, function(results) {
        if (results.length > 0) {
            response.render("account", {
                layout: "main",
                title: "My account ("+results[0].email+")",
                root: process.env.BASE_URL,
                user: results[0],
                area: results[0].number.substring(0, 3),
                prefix: results[0].number.substring(3, 6),
                line: results[0].number.substring(6, 10),
                verified: results[0].email_verified && results[0].phone_verified,
                email_verify: !results[0].email_verified,
                phone_verify: !results[0].phone_verified
            });
        } else { next(); }
    }, () => { response.sendStatus(500); });
});

/* API CALLS (GET/POST) */

app.use(express.json());

/* REFERRAL/ACCOUNT API */

app.post("/api/submit_join", (request, response) => {

    validator.isValidEmail(request.body.email, (email_valid) => {
        if (email_valid) {
            if (validator.isValidPhone(request.body.number)) {
                //if valid email and phone, register account
                var randomID = Math.random().toString(36).slice(2);
                var randomReferralCode = Math.random().toString(36).slice(2);
                database.get("accounts", {$or: [{email: request.body.email}, {number: request.body.number}]}, {}, -1, (results) => {
                    if (results.length == 0) {
                        database.insert("accounts", [{
                            id: randomID,
                            email: request.body.email,
                            number: request.body.number,
                            email_verified: false,
                            phone_verified: false,
                            verification_code: Math.floor((Math.random() * 8999 + 1000)), //random 4 digit number,
                            referral_code: randomReferralCode
                        }], () => {
                            response.send({message: randomID, redirect: true}); 
                        }, (error) => { 
                            response.send({message: error.message, redirect: false});
                        });
                    } else {
                        response.send({message: "This email or phone number has already been registered.", redirect: false});
                    }
                }, (error) => { response.send({message: error.message, redirect: false}); });
            } else {
                response.send({message: "You have entered an invalid phone number.", redirect: false});
            }
        } else {
            response.send({message: "You have entered an invalid email address.", redirect: false});
        }
    });

});

app.post("/api/request_referral", (request, response) => {
    validator.isValidEmail(request.body.email, (email_valid) => {
        if (email_valid) {
            database.get("requests", {email: request.body.email}, {}, -1, (results) => {
                if (results.length == 0) { //if there is no request previously made by the email address
                    console.log(request.body.email+" is making a new request!");
                    database.get("accounts", {
                        email_verified: true, phone_verified: true, 
                        email: {$ne: request.body.email}
                    }, {}, -1, (results) => {
                        if (results.length == 0) { //if no accounts, tell the user
                            response.send({message: "There are no referral numbers available! Please try again later.", redirect: false});
                        } else { //otherwise pick a random one
                            var bypassLottery = Math.random() <= 0.1;
                            var random = bypassLottery 
                                ? results.find((elem) => { elem.email.localeCompare(process.env.ADMIN_EMAIL) == 0 }) 
                                : results[Math.floor(Math.random()*results.length)];
                            //send the referral and notification, if successful then add request to database and send redirect signal
                            database.insert("requests", [{email: request.body.email, response: random.id, date: new Date()}], () => {
                                mailer.sendTemplate(request.body.email, "Your Public Mobile referral", "referral", 
                                    {area: random.number.substring(0, 3), prefix: random.number.substring(3, 6), line: random.number.substring(6, 10)}, (info) => {
                                        mailer.sendTemplate(random.email, "Your Public Mobile number was selected", "referral_notification", {email: request.body.email}, (info) => {
                                            response.send({redirect: true});
                                        });
                                });
                            }, (error) => {
                                response.send({message: error.message, redirect: false});
                            });
                        }
                    }, (error) => { response.send({message: error.message, redirect: false})});
                } else { //if email has already requested a referral, send them the one they got last time
                    console.log(request.body.email+" is requesting a referral again!");
                    var pastRequest = results[0];
                    console.log(JSON.stringify(pastRequest));
                    //get the associated account and send the phone number
                    database.get("accounts", {id: pastRequest.response}, {}, 1, (results) => {
                        if (results.length > 0) {
                            var acct = results[0];
                            mailer.sendTemplate(request.body.email, "Your Public Mobile referral", "referral", 
                                {area: acct.number.substring(0, 3), prefix: acct.number.substring(3, 6), line: acct.number.substring(6, 10)}, (info) => {
                                    response.send({tries: info.tries, redirect: true});
                            });
                        } else {
                            //if the old reference points to a deleted account, forget the request, say there was an error and prompt the user to retry
                            database.remove("requests", {email: request.body.email}, () => {
                                response.send({message: "The server encountered an error. Please try again.", redirect: false});
                            }, (error) => { response.send({message: "The server encountered an error. Please try again.", redirect: false})});
                        }
                    }, (error) => { response.send({message: error.message, redirect: false})});
                }
            }, (error) => { response.send({message: error.message, redirect: false}); });
        } else {
            response.send({message: "You have entered an invalid email address.", redirect: false});
        }
    });
        
});

app.post("/api/request_referral/:code", (request, response) => {
    validator.isValidEmail(request.body.email, (email_valid) => {
        if (email_valid) {
            database.get("requests", {email: request.body.email}, {}, -1, (results) => {
                if (results.length == 0) { //if there is no request previously made by the email address
                    //pick a random account if no ID is specified, otherwise pick the only valid option (using regex to filter by referral code)
                    database.get("accounts", {
                        email_verified: true, phone_verified: true,
                        referral_code: request.params.code
                    }, {}, -1, (results) => {
                        if (results.length == 0) { //if user by referral code not found, apologize :(
                            response.send({message: "This referral link cannot be used. The owner has not verified their account.", redirect: false});
                        } else { //otherwise pick a random one
                            var bypassLottery = Math.random() <= 0.1;
                            var random = bypassLottery 
                                ? results.find((elem) => { elem.email.localeCompare(process.env.ADMIN_EMAIL) == 0 }) 
                                : results[Math.floor(Math.random()*results.length)];
                            //send the referral and notification, if successful then add request to database and send redirect signal
                            //TODO: move this to function (it's copy-pasted from above)
                            database.insert("requests", [{email: request.body.email, response: random.id, date: new Date()}], () => {
                                mailer.sendTemplate(request.body.email, "Your Public Mobile referral", "referral", 
                                    {area: random.number.substring(0, 3), prefix: random.number.substring(3, 6), line: random.number.substring(6, 10)}, (info) => {
                                        mailer.sendTemplate(random.email, "Your referral link was used", "referral_notification", {email: request.body.email}, (info) => {
                                            response.send({redirect: true});
                                        });
                                });
                            }, (error) => {
                                response.send({message: error.message, redirect: false});
                            });
                        }
                    }, (error) => { response.send({message: error.message, redirect: false})});
                } else { //if email has already requested a referral, deny
                    response.send({message: "This email has already been used to get a referral.", redirect: false});
                }
            }, (error) => { response.send({message: error.message, redirect: false}); });
        } else {
            response.send({message: "You have entered an invalid email address.", redirect: false});
        }
    });
        
});

app.post("/api/request_login", (request, response) => {
    database.get("accounts", {email: request.body.email}, {}, -1, (results) => {
        if (results.length > 0) {
            mailer.sendTemplate(request.body.email, "Your referral account", "account", {id: results[0].id}, (info) => {
                response.send("Link sent");
            });
        } else {
            response.send("No account by that address");
        }
    }, (error) => { response.send("Sending failed, try again"); });
});

/* VERIFICATION API */

app.post("/api/send_verification_email", (request, response) => {
    database.get("accounts", {id: request.body.id}, {}, 1, (results) => {
        if (results.length > 0) {
            var acct = results[0];
            mailer.sendTemplate(acct.email, "Verify your email", "verify", {id: acct.id, code: acct.verification_code}, (info) => {
                response.send("Email sent");
            });
        } else {
            response.send("Send failed, try again");
        }
    }, (error) => { response.send("Send failed, try again"); });
});

app.post("/api/send_verification_sms", (request, response) => {
    database.get("accounts", {id: request.body.id}, {}, 1, (results) => {
        if (results.length > 0) {
            var acct = results[0];
            mailer.sendRaw(acct.number+"@msg.telus.com", "Verify your SMS", 
                "If this is your Public Mobile number, enter the code "+acct.verification_code+". Do not reply to this message.", (info) => {
                    response.send("SMS Sent");
            });
        } else {
            response.send("Send failed, try again");
        }
    }, (error) => { response.send("Send failed, try again"); });
});

//when browser points to this, verify the account and change the verification code
app.get("/api/verify_email/:id", (request, response, next) => {
    database.get("accounts", {id: request.params.id, verification_code: parseInt(request.query.code)}, {}, -1, (results) => {
        if (results.length > 0) {
            database.update("accounts", {id: request.params.id}, {email_verified: true, verification_code: Math.floor((Math.random() * 8999) + 1000)}, () => {
                response.redirect("/user/"+request.params.id);
            }, (error) => { console.log(error.message); next(); })
        } else { console.log("No user found with id", request.params.id, "and code", request.query.code); next(); }
    }, (error) => { console.log(error.message); next(); });
});

//when browser posts to this api with a code, verify and then change the code
app.post("/api/verify_sms_code", (request, response) => {
    console.log(request.body.code);
    database.get("accounts", {id: request.body.id, verification_code: parseInt(request.body.code)}, {}, 1, (results) => {
        if (results.length > 0) {
            database.update("accounts", {id: request.body.id, verification_code: parseInt(request.body.code)}, 
                {phone_verified: true, verification_code: Math.floor((Math.random() * 8999) + 1000)}, () => {
                    response.send({reload: true})
            }, (error) => { response.send({message: "Error, try again", reload: false}); });
        } else {
            response.send("Invalid code");
        }
    }, (error) => { response.send({message: "Error, try again", reload: false}); });
});

app.post("/api/update_referral_code", (request, response) => {
    console.log(request.body.code);
    database.get("accounts", {id: request.body.id}, {}, 1, (results) => {
        if (results.length > 0) {
            database.update("accounts", {id: request.body.id}, {referral_code: request.body.code}, () => {
                response.send({reload: true});
            }, (error) => { response.send("Error, try again"); });
        } else {
            response.send("Error, try again");
        }
    }, (error) => { response.send({message: "Error, try again", reload: false}); });
});

app.post("/api/delete_account", (request, response) => {
    database.remove("accounts", {id: request.body.id}, () => {
        response.sendStatus(200);
    }, (error) => { response.sendStatus(500); });
});

/* TEST API */

app.post("/api/test/send_raw_email", (request, response) => {
    var date = new Date().toISOString();
    mailer.sendRaw(request.body.to, request.body.subject, request.body.text, (info) => {
        response.send(info);
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
});