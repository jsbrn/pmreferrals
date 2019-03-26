require('dotenv').config() //load the environment variables

const path = require('path');
//load express
const express = require('express')
const app = express()
const exphbs = require('express-handlebars');
const database = require('./app/database.js');
const session = require('express-session');
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

/*Enable Express session tracking*/
app.set('trust proxy', 1) // trust first proxy
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}))

/*HTTP REQUEST HANDLERS*/

//post all requests to the console
app.all("*", (request, response, next) => {
    console.log(request.method, request.url, request.params, request.query, request.body);
    next();
});

app.get('/', (request, response) => {
    response.render("home", {
        layout: "main.hbs"
    });
});

app.get('/join', (request, response) => {
    response.render("join", {
        layout: "main.hbs"
    });
});

app.get('/referral', (request, response) => {
    response.render("referral", {
        layout: "main.hbs",
    });
});

app.get('/faq', (request, response) => {
    response.render("faq", {
        layout: "main.hbs"
    });
});

app.get('/success', (request, response) => {
    response.render("success", {
        layout: "main.hbs"
    });
});

app.get('/user/:id', (request, response, next) => {
    database.get("accounts", {id: request.params.id}, {}, 1, function(results) {
        if (results.length > 0) {
            response.render("account", {
                layout: "main.hbs",
                user: results[0]
            });
        } else { next(); }
    }, () => { response.sendStatus(500) ;});
});

//POST Parameter api for Spigot to connect to

app.use(express.json());

app.get("/api/email_test", (request, response) => {
    var date = new Date().toISOString();
    mailer.sendTemplate(process.env.ADMIN_EMAIL, "Test Referral", "referral", {area: 555, prefix: 555, line: 5555, id: "xxxxxxx"}, function(error, info) {
        console.log(date, error, info);
        response.send(info);
    });
});

app.post("/api/submit_join", (request, response) => {

    var number = request.body.area + request.body.prefix + request.body.line;

    if (!validator.isValidPhone(number)) {
        response.send({message: "You have entered an invalid phone number.", redirect: false});
    } else if (!validator.isValidEmail(request.body.email)) {
        response.send({message: "You have entered an invalid email address.", redirect: false});
    } else {
        var randomID = Math.random().toString(36).slice(2);
        database.get("accounts", {$or: [{email: request.body.email}, {full_number: number}]}, {}, -1, (results) => {
            if (results.length == 0) {
                database.insert("accounts", [{
                    id: randomID,
                    email: request.body.email,
                    area: request.body.area,
                    prefix: request.body.prefix,
                    line: request.body.line,
                    full_number: number,
                    email_verified: false,
                    phone_verified: false
                }], () => {
                    response.send({message: randomID, redirect: true}); 
                }, (error) => { 
                    response.send({message: error.message, redirect: false});
                });
            } else {
                response.send({message: "This email or phone number has already been registered.", redirect: false});
            }
        }, (error) => { response.send({message: error.message, redirect: false}); });
    }

});

app.post("/api/request_referral", (request, response) => {
    if (!validator.isValidEmail(request.body.email)) {
        response.send({message: "You have entered an invalid email address.", redirect: false});
    } else {
        database.get("requests", {email: request.body.email}, {}, -1, (results) => {
            if (results.length == 0) { //if there is no request previously made by the email address
                console.log(request.body.email+" is making a new request!");
                //pick a random account (not the account of the email address given) to send
                database.get("accounts", {/*verified: true, */email: {$ne: request.body.email}}, {}, -1, (results) => {
                    if (results.length == 0) { //if no accounts, tell the user
                        response.send({message: "There are no referral numbers available! Please try again later.", redirect: false});
                    } else { //otherwise pick a random one
                        var random = results[Math.floor(Math.random()*results.length)];
                        //send the email, if successful then add request to database and send redirect signal
                        mailer.sendTemplate(request.body.email, "Your Public Mobile referral", "referral", {area: random.area, prefix: random.prefix, line: random.line}, (error, info) => {
                            if (error) {
                                console.log(error.message);
                                response.send({message: "There was an error sending the email. This happens sometimes. Please try again.", redirect: false});
                            } else {
                                database.insert("requests", [{email: request.body.email, response: random.id}], () => {
                                    response.send({redirect: true});
                                }, (error) => {
                                    response.send({message: error.message, redirect: false});
                                });
                            }
                        });
                    }
                }, (error) => { response.send({message: error.message, redirect: false})});
            } else { //if email has already requested a referral, send them the one they got last time
                console.log(request.body.email+" is requesting a referral again!");
                var pastRequest = results[0];
                console.log(JSON.stringify(pastRequest));
                //get the associated account and send the phone number
                database.get("accounts", {id: pastRequest.response}, {}, 1, (results) => {
                    var acct = results[0];
                    mailer.sendTemplate(request.body.email, "Your Public Mobile referral", "referral", {area: acct.area, prefix: acct.prefix, line: acct.line}, (error, info) => {
                        if (error) {
                            console.log(error.message);
                            response.send({message: "There was an error sending the email. This happens sometimes. Please try again.", redirect: false});
                        } else {
                            response.send({redirect: true});
                        }
                    });
                }, (error) => { response.send({message: error.message, redirect: false})});
            }
        }, (error) => { response.send({message: error.message, redirect: false}); });
    }
});

app.post("/api/update_email", (request, response) => {
    if (validator.isValidEmail(request.body.email)) {
        database.update("accounts", {id: request.body.id}, {email: request.body.email}, () => {
            response.send({reload: true});
        }, (error) => { response.send({message: error.message, reload: false})});
    } else {
        response.send({message: "You have entered an invalid email address!", reload: false});
    }
});

app.post("/api/update_phone", (request, response) => {
    if (validator.isValidPhone(request.body.area, request.body.prefix, request.body.line)) {
        database.update("accounts", {id: request.body.id}, 
            {area: request.body.area, 
            prefix: request.body.prefix, 
            line: request.body.line, 
            full_number: request.body.area + request.body.prefix + request.body.line}, 
            () => {
                response.send({reload: true});
        }, (error) => { response.send({message: error.message, reload: false})});
    } else {
        response.send({message: "You have entered an invalid phone number!", reload: false});
    }
});

app.post("/api/delete_account", (request, response) => {
    database.remove("accounts", {id: request.body.id}, () => {
        response.sendStatus(200);
    }, (error) => { response.sendStatus(500); });
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