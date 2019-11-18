require('dotenv').config() //load the environment variables

const path = require('path');
//load express
const express = require('express')
const app = express()
const exphbs = require('express-handlebars');
const database = require('./app/database.js');
const cleanup = require('./app/cleanup.js');
const utilities = require('./app/utilities.js')
const mailer = require('./app/mailer.js');
const validator = require('./app/validator.js');

/*Set the Handlebars options, including the Helpers*/
app.engine('.hbs', exphbs({
      defaultLayout: 'main',
      extname: '.hbs',
      layoutsDir: path.join(__dirname, 'views/layouts'),
      helpers: {
          cardRow: (rowArray) => {
              console.log(JSON.stringify(player));
              var status = player.banned ? "banned" : (player.online ? "online" : "offline");
              status = status + (!player.member ? "-guest" : "");
              return status;
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

app.post("/api/create_account", (request, response, next) => {

    if (!request.body.email || !request.body.number) { next(); return; }

    validator.isValidEmail(request.body.email, () => {
        if (validator.isValidPhone(request.body.number)) {
            //if valid email and phone, register account
            var randomID = Math.random().toString(36).slice(2);
            var randomReferralCode = Math.random().toString(36).slice(2);
            database.get("accounts", {$or: [{email: request.body.email}, {number: request.body.number}]}, {}, -1, (results) => {
                if (results.length == 0) {

                    var newAccount = {
                        id: randomID,
                        email: request.body.email,
                        number: ""+request.body.number,
                        email_verified: false,
                        phone_verified: false,
                        verification_code: Math.floor((Math.random() * 8999 + 1000)), //random 4 digit number,
                        referral_code: randomReferralCode
                    };

                    if (!request.body.test) {
                        database.insert("accounts", [newAccount], () => {
                            response.send({accepted: true, account: newAccount});
                        }, (error) => { response.sendStatus(502); });
                    } else { //if testing, send the response but do not update the database
                        response.send({accepted: true, account: newAccount});
                    }
                    
                } else {
                    response.send({accepted: false, reason: "This email or phone number has already been registered."});
                }
            }, (error) => { response.sendStatus(502); });
        } else {
            response.send({accepted: false, reason: "You have entered an invalid phone number."});
        }
    }, () => { //invalid email address
        response.send({accepted: false, reason: "You have entered an invalid email address."})
    });

});

/**
 * Requesting a referral.
 */
app.post("/api/request_referral", (request, response, next) => {

    //ensure all required fields are present
    if (!request.body.email) { next(); return; }
    //determine the query object based on what type of referral it is (random or specific to a user)
    var query = !request.body.referral_code
        ? {email_verified: true, phone_verified: true, email: {$ne: request.body.email}} 
        : {email_verified: true, phone_verified: true, email: {$ne: request.body.email}, referral_code: request.body.referral_code};
    //query the accounts table
    database.get("accounts", query, {}, -1, (accounts) => {
        if (accounts.length > 0) { //if there is an available account, pick a random one

            var randomIndex = Math.floor(Math.random()*accounts.length);
            var randomAccount = accounts[randomIndex];

            validator.isValidEmail(request.body.email, () => { //
                database.get("requests", {email: request.body.email}, {}, 1, (requests) => {
                    if (requests.length < 1) { //if there are no matches, send and update the requests table
                        //send mail
                        if (!request.body.test) mailer.sendReferral(request.body.email, randomAccount);
                        //update requests table
                        if (!request.body.test) database.insert("requests", [{
                            email: request.body.email,
                            response: randomAccount.id,
                            date: new Date(),
                            random: !request.body.referral_code
                        }], (inserted) => {}, (error) => { response.sendStatus(502); });
                        //send the response back to the database
                        response.send({accepted: true, index: randomIndex});
                    } else { //otherwise, inform the client
                        response.send({accepted: false, reason: "This email address has already been used to get a referral."});
                    }
                }, (error) => { response.sendStatus(502); });
            }, () => { response.send({accepted: false, reason: "Email address is invalid."})});

        } else { response.send({accepted: false, reason: "No referrals are available at this time."}); }
    }, (error) => { response.sendStatus(502); });

});

app.post("/api/request_login", (request, response) => {
    database.get("accounts", {email: request.body.email}, {}, -1, (results) => {
        if (results.length > 0) {
            if (!request.body.test) {
                mailer.sendTemplate(request.body.email, "Your referral account", "account", {id: results[0].id}, (info) => {
                    response.send({accepted: true});
                });
            } else {
                response.send({accepted: true});
            }
        } else {
            response.send({accepted: false, reason: "No account by that address"});
        }
    }, (error) => { response.send(502); });
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
            mailer.sendVerificationSMS(acct.number, (info) => {
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

//catch all for API requests: previous handlers will send the request to this one if the request is missing critical fields
app.post('/api/*', (request, response) => {
    response.sendStatus(400);
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