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

function verifyCode(code, callback) {

    const agent = new https.Agent({  
        rejectUnauthorized: false
    });
    
    axios.get("https://activate.publicmobile.ca/?raf="+code, { httpsAgent: agent })
        .then(function (axios_response) {
            //if it has the green checkmark it's a valid code
            var broken_page = !axios_response.data.includes("ok_16x16") && !axios_response.data.includes("failure_16x16");
            callback({
                valid: axios_response.data.includes("ok_16x16"),
                error: broken_page
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
module.exports.verifyCode = verifyCode;