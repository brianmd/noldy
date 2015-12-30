'use strict'


// TODO: separate summary from detail on orders, returns, invoices


const debug = require('debug');
const redis = require('redis');
const redisWrapper = require('co-redis');
const redisClient = redisConnect(process.env.redis_host, process.env.redis_port, process.env.redis_password);

const logerror = debug('error');
const logbapis = debug('bapis');
const logaccounts = debug('accounts');
const logrunning = debug('running');

const bapis = {};
const bapiAccounts = {};
const running = {};

redisClient.on('message', (channel, message) => {
  var arr = JSON.parse(message)
  arr[2][0] = arr[2][0].toUpperCase();
  processBapiCounts(arr);
  processBapiAccounts(arr);
})

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
    case 'Z_O_INVOICES_QUERY':
      account = arr[2][1]['i_customer'];
      break;
    case 'Z_ISA_MAT_AVAILABILITY':
    case 'Z_O_VBFA_EXTRACT':        // doc flow
      break;
    default:
      console.log(arr);
      break;
  }

  if (!account) return;

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
  logaccounts(bapiAccounts);
}

function processBapiCounts(arr) {
  var name = arr[2][0];
  var start;
  var avg;
  var duration;
  var stringified = JSON.stringify(arr[2]);

  switch (arr[0]) {
    case 'start':
      addTo(name, 1, 1);
      running[stringified] = arr[1];
      logbapis([arr[0], name, bapis]);
      break;
    case 'stop':
      addTo(name, 0, -1);
      start = running[stringified]
      if (start) {
        delete running[stringified];
        let bs = bapis[name];
        avg = bs[2];
        duration = arr[1] - start;
        let counts = bs[0];
        // console.log(avg, duration, counts);
        avg = avg + duration/counts;
        bs[2] = avg;
      }
      logbapis([arr[0], name, duration, bapis]);
      break;
    case 'error':
      logerror('\n\nbapi returned an error: ', arr);
      break;
  }
  logrunning(running);
}

function addTo(bapiName, totalCounts, delta) {
  var val = bapis[bapiName];
  if (typeof val == 'undefined') val = [0, 0, 0];
  bapis[bapiName] = [val[0]+totalCounts, val[1]+delta, val[2]];
}

