"use strict";


const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const LookupsClient = require('twilio').LookupsClient;
const client = new LookupsClient(accountSid, authToken);
const MongoClient = require('mongodb').MongoClient;
let collection;
let db;

const request = require('request');
const url = "https://" + accountSid + ":" + authToken + "@lookups.twilio.com/v1/PhoneNumbers/";

const kue = require('kue')
 , queue = kue.createQueue();

const dbUrl = 'mongodb://localhost/voya_lookup'

MongoClient.connect(dbUrl, function(err, db) {
  if(err) { return console.dir(err); }

  collection = db.collection('lookups');
  queue.process('lookup', 20, function(job, ctx, done) {
    lookup(job.data.phone_number, ctx, done);
  });
});

function lookup(number, ctx, done) {

  request(url + number + '?Type=carrier', function(error, response, body) {

    console.log(`back from lookup ${response}`);
    if (error) {
      console.log(error);
      console.log(error.status);
      console.log(error.message);

      console.log("Mark this job as failed");
      done(error);
    } else {
      let number = JSON.parse(body);
      if (number.carrier === undefined) {
        number.carrier = {type: "", mobile_network_code: "", mobile_country_code: "", error_code: ""}
      }
      collection.insert({number: number.phone_number, type: number.carrier["type"], name: number.carrier["name"],
            mobile_network_code: number.carrier["mobile_network_code"],
            mobile_country_code: number.carrier["mobile_country_code"],
            error_code: number.carrier["error_code"]},
      function(err, result) {
        if(err)
          throw(err);
        console.log("record added");
        done();
      });
    }
  });
}

queue.on('job failed', function(errorMessage){
  console.log('Job finally failed');
  console.log(errorMessage);
  queue.shutdown( 1000, function(err) {
    console.log( 'Kue shutdown: ', err||'' );
    process.exit( 0 );
  });
});

queue.on('job failed attempt', function(errorMessage, doneAttempts){
  console.log('Job failed');
  console.log(doneAttempts);
});
