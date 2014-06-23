
var http = require('http');
var express = require('express');
var path = require('path');
var request = require('request');

var token = null; // OAuth token for anonymous login
// If no store URL prefix is indicated, use the default tenant.
var defaultTenant =  process.env.DEFAULT_TENANT || 'onlineshop';
var storeNameConfigKey = 'store.settings.name';
var storeFrontProjectId = '93b808b0-98f0-42e3-b1a8-ef81dac762b6';

var configSvcUrl = 'http://configuration-v2.test.cf.hybris.com/configurations/';
var authSvcUrl = 'http://user-service.test.cf.hybris.com/auth/';


//****************************************************************
// Load the token for the anonymous login:

function getParameterByName(name, url) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(url);
    return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

request.post(
        authSvcUrl + 'anonymous/login?hybris-tenant='+storeFrontProjectId,
    { form: { key: 'value' } },
    function (error, response, body) {
        console.log('token request response: '+ response.statusCode);
        if (error ) {
            console.log(error);
        }
        token = getParameterByName('access_token', response.headers['location']);

    }
);
// **************************************************************************

// Build the server
var app = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

// map store-specific access to static files in /public
app.use("/:storename?/public", express.static(__dirname + '/public'));

// Generate index.html with store name injected as "title"
// Store name is retrieved from config service
app.get('/:storename?/', function(req, response, next){
    // tenant and url prefix/store name equivalent at this time
    var tenant = defaultTenant;
    if(req.params["storename"]) {
        tenant =  req.params["storename"];
    }
    //console.log('making request to config service for '+storename);
    var configSvcOptions = {
        url: configSvcUrl+storeNameConfigKey,
        headers: {
            'hybris-tenant': tenant
        }
    };

    //console.log(configSvcOptions);
    request.get(configSvcOptions, function(error, reponse, body) {
        //console.log("got response!");
        if(!error) {
            //console.log(body);
            response.render("index", {store: {name: JSON.parse(body).value, style: 'public/css/app/style.css'}});
        } else {
            console.log(error);
            next(error);
        }
    })
});

//*********************
// Store-Config route - returns settings with tenant and access token for a particular storefront
app.get('/:storename?/storeconfig', function(request, response) {
    // tenant and url prefix/store name equivalent at this time
    var tenant = defaultTenant;
    if(request.params["storename"]) {
        tenant =  request.params["storename"];
    }
    console.log('request for store config for '+tenant);
    var json = JSON.stringify( {
            storeTenant: tenant,
            accessToken: token }
    );
    //console.log(json);
    response.send(json);
});

// ANGULAR UI-ROUTER WORKAROUND - append trailing '/'
// Long-term, this should be fixed in router.js.
app.get("/:storename", function(request, response){
    var newUrl = request.url+'/';
    //console.log('redirect to '+newUrl);
    response.redirect(newUrl);
}) ;

module.exports = app;






