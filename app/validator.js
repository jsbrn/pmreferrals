const jq = require('jquery');

function isValidEmail(email) {
    var n_patt = e_patt = /(.+)@(.+){2,}\.(.+){2,}/;
    return e_patt.test(email);
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