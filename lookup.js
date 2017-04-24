"use strict";

const redis = require('redis');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const LookupsClient = require('twilio').LookupsClient;
const client = new LookupsClient(accountSid, authToken);
const redisClient = redis.createClient();

const kue = require('kue')
 , queue = kue.createQueue();

queue.process('lookup', function(job, done) {
  lookup(job.data.phone_number, done);
});

function lookup(number, done) {
  client.phoneNumbers(number).get({

  }, (error, number) => {
    console.log(`back from lookup ${number.phone_number} is ${number.carrier["type"]}`);
    if (error) {
      console.log(error);
      queue.shutown(1000, function(err) {
        console.log( 'Kue shutdown: ', err||'' );
        process.exit( 0 );
      });
      return done(new Error('couldnt connect'));
    } else {
      redisClient.rpush([
        "numbers",
        number.phone_number
      ]);
      redisClient.rpush([
          number.phone_number,
          number.carrier["type"],
          number.carrier["name"],
          number.carrier["mobile_network_code"],
          number.carrier["mobile_country_code"],
          number.carrier["error_code"]
        ]
      );
      done();
    }
  });
}
