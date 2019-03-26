const jq = require('jquery');
const request = require('request');

function isValidEmail(email, callback) {
    request('https://api.debounce.io/v1/?api=disposable&email='+email, { json: true }, (err, res, body) => {
        var validForm = /(.+)@(.+){2,}\.(.+){2,}/.test(email);
        console.log(body);
        if (err) { 
            callback(validForm);
        } else {
            callback(validForm && body.disposable == 'false');
        }
    });
}

function isValidPhone(area, prefix, line) {
    return isValidPhone(area+""+prefix+""+line);
}

function isValidPhone(number) {
    var n_patt = /\d\d\d\d\d\d\d\d\d\d/g;
    return n_patt.test(number);
}

module.exports.isValidEmail = isValidEmail;
module.exports.isValidPhone = isValidPhone;