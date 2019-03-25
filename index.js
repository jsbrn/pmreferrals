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

app.get('/user/:accountID', (request, response, next) => {
    database.get("accounts", {url: request.params.accountID}, {}, 1, function(results) {
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
    mailer.send(process.env.TEST_RECIPIENT, "This is a test!", "Generated on "+date, function(error, info) {
        console.log(date, error, info);
        response.send(info);
    });
});

app.post("/api/submit_join", (request, response) => {
    console.log(request.body);

    var n_patt = /\d\d\d\d\d\d\d\d\d\d/g, e_patt = /(.+)@(.+){2,}\.(.+){2,}/;
    var number = request.body.area + request.body.prefix + request.body.line;
    var email = request.body.email;

    var validNumber = n_patt.test(number);
    var validEmail = e_patt.test(email);

    if (!validNumber) {
        response.send({message: "You have entered an invalid phone number.", redirect: false});
    } else if (!validEmail) {
        response.send({message: "You have entered an invalid email address.", redirect: false});
    } else {
        var randomID = Math.random().toString(36).slice(2);
        database.get("accounts", {email: email}, {}, -1, (results) => {
            if (results.length == 0) {
                database.get("accounts", {full_number: number}, {}, -1, (results) => {
                    if (results.length == 0) {
                        database.insert("accounts", [{
                            url: randomID,
                            email: email,
                            area: request.body.area,
                            prefix: request.body.prefix,
                            line: request.body.line,
                            full_number: number
                        }], () => { 
                            response.send({message: randomID, redirect: true}); 
                        }, () => { 
                            response.send({message: "An error has occurred, please try again later.", redirect: false});
                        });
                    } else {    
                        response.send({message: "The number you entered is already registered!", redirect: false});
                    }
                });
            } else {
                response.send({message: "An account by that email already exists!", redirect: false});
            }
        }, (error) => { response.send({message: "An error has occurred, please try again later.", redirect: false}); });
    }

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
    //console.log(JSON.stringify(process.env));
    database.connect();
});