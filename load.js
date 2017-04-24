"use strict";

const fs = require("fs");
const csv = require("fast-csv");
const phone = require('node-phonenumber');
const kue = require('kue');

const phoneUtil = phone.PhoneNumberUtil.getInstance();

let stream = fs.createReadStream("export.csv");

let validNumbers = [];
let invalidNumbers = [];

let queue = kue.createQueue();

let csvStream = csv({headers: '#ANI'})
    .on("data", function(data){
      try {
        let number = data[0];
        console.log(number);
        let phoneNumber = phoneUtil.parse(number,'US');
        let isValid = phoneUtil.isValidNumber(phoneNumber);
        if (isValid) {
          let job = queue.create('lookup', {
            title: number,
            phone_number: number
          }).attempts(3).backoff( {delay: 1000, type:'fixed'} ).save( function(err) {
            if( !err ) console.log(job.id);
          });
        } else {
          invalidNumbers.push(number);
        }
      }
      catch (e) {
        console.log(e);
      }
    })
    .on("end", function(){
         console.log("DONE PARSING");
    });

stream.pipe(csvStream);
