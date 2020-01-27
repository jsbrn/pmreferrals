var MongoClient = require('mongodb').MongoClient;
var database;
var client;

function connect() {
    var srv = process.env.MONGODB_SRV_RECORD != "false";
    var authSpecified = process.env.MONGODB_PASSWORD && process.env.MONGODB_USERNAME;
    var url = "mongodb"
        +(srv ? "+srv" : "")
        +"://"
        +process.env.MONGODB_USERNAME
        +(authSpecified ? ":" : "")
        +process.env.MONGODB_PASSWORD
        +(authSpecified ? "@" : "")
        +process.env.MONGODB_URL+":"+process.env.MONGODB_PORT+"/test?retryWrites=false";
    MongoClient.connect(url, function(err, cl) {
        if (err) { console.log("Error connecting to database at URL "+url+" : "+err.message); return; }
        database = cl.db(process.env.MONGODB_DATABASE);
        client = cl;
        console.log("Connected to database: "+url);
    });
}

function disconnect() {
    client.close(false, function() {
        console.log("Database connection closed!");
    });
}

function update(collectionName, query, new_value, onSuccess, onFailure) {
    var collection = database.collection(collectionName);
    collection.updateMany(query, {$set: new_value}, function(err, docs) {
        if (err) { 
            console.log(err.message); 
            onFailure();
        } else {
            onSuccess(docs);
        }
    });
}

function insert(collectionName, entries, onSuccess, onFailure) {
    var collection = database.collection(collectionName);
    collection.insertMany(entries, function(err, docs) {
        if (err) { 
            console.log(err.message); 
            onFailure();
        } else {
            onSuccess(docs);
        }
    });
};

function get(collectionName, findQuery, sortQuery, limit, onSuccess, onFailure) {
    // Get the collection
    var collection = database.collection(collectionName);
    // Find some entries that match
    collection.find(findQuery)
        .sort(sortQuery)
        .limit(limit < 0 ? Number.MAX_SAFE_INTEGER : limit)
        .toArray(function(err, docs) {
            if (err) { 
                console.log(err.message); 
                onFailure(err);
            } else {
                onSuccess(docs);
            }
    });
};

function remove(collectionName, query, onSuccess, onFailure) {
    var collection = database.collection(collectionName);
    collection.deleteMany(query, function(err, docs) {
        if (err) { 
            console.log(err.message); 
            onFailure();
        } else {
            onSuccess(docs);
        }
    });
};

module.exports.connect = connect;
module.exports.disconnect = disconnect;
module.exports.insert = insert;
module.exports.get = get;
module.exports.update = update;
module.exports.remove = remove;