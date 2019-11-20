const request = require('request');
const https = require('https');
const axios = require('axios');

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

function findOnPage(needle, url, callback) {
    
    const agent = new https.Agent({  
        rejectUnauthorized: false
    });
    
    axios.get(url, { httpsAgent: agent })
        .then(function (axios_response) {
            //if it has the green checkmark it's a valid code
            callback({
                valid: axios_response.data.includes(needle)
            })
        })
        .catch(function (err) {
            callback({
                error: err
            });
        });
        
}

module.exports.isValidEmail = isValidEmail;
module.exports.isValidPhone = isValidPhone;
module.exports.findOnPage = findOnPage;