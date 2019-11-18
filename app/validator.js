const request = require('request');

function isValidEmail(email, ifValid, ifInvalid) {
    request('https://api.debounce.io/v1/?api=disposable&email='+email, { json: true }, (err, res, body) => {
        var validForm = /(.+)@(.+){2,}\.(.+){2,}/.test(email);
        console.log(body);
        if (err) { 
            ifValid();
        } else {
            if (validForm && body.disposable == 'false') ifValid(); else ifInvalid();
        }
    });
}

function isValidPhone(number) {
    var n_patt = /\d\d\d\d\d\d\d\d\d\d/g;
    return n_patt.test(number) && number.length == 10;
}

module.exports.isValidEmail = isValidEmail;
module.exports.isValidPhone = isValidPhone;