'use strict'


// TODO: separate summary from detail on orders, returns, invoices

var lastLogSeconds = 0;
var logInterval = 10 * 60;
var path = '/Users/bmd/data/papichulo/';

const debug = require('debug');
const redis = require('redis');
const redisWrapper = require('co-redis');
const redisClient = redisConnect(process.env.redis_host, process.env.redis_port, process.env.redis_password);
const fs = require('fs');

const logerror = debug('error');
const logbapis = debug('bapis');
const logaccounts = debug('accounts');
const logrunning = debug('running');

var bapis = {};
var bapiAccounts = {};
var running = {};

redisClient.on('message', (channel, message) => {
  var arr = JSON.parse(message);
  arr[2][0] = prepBapiName(arr);
  processBapiAccounts(arr);   // process accounts first, because it finds the account number
  processBapiCounts(arr);
  logData();
})

function secondsNow() {
  return new Date().getTime() / 1000;
}

function logData() {
  var seconds = secondsNow();
  if (secondsNow - lastLogSeconds > logInterval) {
    lastLogSeconds = seconds;
    let mybapis = bapis;
    let myaccounts = bapiAccounts;
    bapis = {};
    bapiAccounts = {};
    fs.appendFile(path+'avgs', JSON.stringify([seconds, mybapis])+'\n', function (err) { if (err) console.log('--- error while writing avgs ---', err) });
    fs.appendFile(path+'accounts', JSON.stringify([seconds, myaccounts])+'\n', function (err) { if (err) console.log('--- error while writing  accounts---', err) });
    fs.appendFile(path+'running', JSON.stringify([seconds, running])+'\n', function (err) { if (err) console.log('--- error while writing running ---', err) });
  }
}

function prepBapiName(arr) {
  var name = arr[2][0].toUpperCase();
  switch (name) {
    case 'Z_O_ORDERS_QUERY':
      if ('i_from_date' in arr[2][1]) name = name+'sum';
      break;
    case 'Z_O_INVOICES_QUERY':
      if ('i_from_date' in arr[2][1]) name = name+'sum';
      break;
  }
  return name;
}

redisClient.on('subscribe', (pattern, count) => {
  console.log('subscribed to '+pattern+', count '+count)
})

redisClient.on('psubscribe', (pattern, count) => {
  console.log('psubscribed to '+pattern+', count '+count)
})

// redisClient.psubscribe('*');
redisClient.subscribe('papichulo.127.0.1.1');

function redisConnect(host, port, pass) {
  port = port || 6379;
  host = host || 'localhost';
  pass = pass || null;
  return redis.createClient(port, host, {auth_pass: pass});
  // return redisWrapper(redis.createClient(port, host, {auth_pass: pass}));
}

function processBapiAccounts(arr) {
  var account;

  if (arr[0]!='start') return;

  var name = arr[2][0];
  switch (name) {
    case 'Z_O_COMPLETE_PRICING':
    case 'Z_O_CONTRACT_QUERY':
      account = arr[2][1]['i_kunnr'];
      break;
    case 'Z_O_ORDERS_QUERY':
    case 'Z_O_ORDERS_QUERYsum':
    case 'Z_O_INVOICES_QUERY':
    case 'Z_O_INVOICES_QUERYsum':
      account = arr[2][1]['i_customer'];
      break;
    case 'BAPI_CUSTOMER_GETDETAIL1':
      account = arr[2][1]['customerno'];
    case 'Z_ISA_MAT_AVAILABILITY':
    case 'Z_O_VBFA_EXTRACT':        // doc flow
      break;
    default:
      console.log(arr);
      fs.appendFile(path+'missing', JSON.stringify([secondsNow(), arr])+'\n', function (err) { if (err) console.log('--- error while writing missing ---', err) });
      break;
  }

  if (!account) return;

  arr.push(['account_number', account]);

  let bapi = bapiAccounts[name];
  if (!bapi) {
    bapi = {};
    bapiAccounts[name] = bapi;
  }
  let count = bapi[account];
  if (count) {
    count = count + 1;
  } else {
    count = 1;
  }
  bapi[account] = count;
  logaccounts('\n');
  logaccounts(bapiAccounts);
  logaccounts('');
}

function processBapiCounts(arr) {
  var name = arr[2][0];
  var account_number, avg, duration, start, startInfo;
  var stringified = JSON.stringify(arr[2]);

  switch (arr[0]) {
    case 'start':
      addTo(name, 1, 1);
      if (arr.length>=4 && (arr[3].constructor===Array) && arr[3][0]=='account_number')
        account_number = arr[3][1];
      running[stringified] = [arr[1],account_number];
      // logbapis([arr[0], name, bapis]);
      break;
    case 'stop':
      addTo(name, 0, -1);
      startInfo = running[stringified];
      if (startInfo) {
        start = startInfo[0];
        account_number = startInfo[1];
        delete running[stringified];
        let bs = bapis[name];
        avg = bs[2];
        duration = arr[1] - start;
        let counts = bs[0];
        if (counts) {
          // console.log(avg, duration, counts);
          avg = avg + (duration-avg)/counts;
          bs[2] = avg;
        }
      }
      fs.appendFile(path+'durations', JSON.stringify([secondsNow(), name, duration, account_number] )+'\n', function (err) { if (err) console.log('--- error while writing durations ---', err) });
      logbapis([arr[0], name, duration]);
      logbapis(bapis);
      break;
    case 'error':
      logerror('\n\nbapi returned an error: ', arr);
      break;
  }
  if (Object.keys(running).length>0) logrunning(running);
}

function addTo(bapiName, totalCounts, delta) {
  var val = bapis[bapiName];
  if (typeof val == 'undefined') val = [0, 0, 0];
  bapis[bapiName] = [val[0]+totalCounts, val[1]+delta, val[2]];
}

