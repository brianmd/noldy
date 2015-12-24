'use strict'

// for jwt: https://sendgrid.com/blog/json-web-tokens-koa-js/

const fs        = require('fs');
const koa       = require('koa');
const parse     = require('co-body');
const serve     = require('koa-static');
const router    = require('koa-router')();
const protectedRouter    = require('koa-router')();
const jwt       = require('koa-jwt');
// const parse     = require('co-body');

const serverApp = koa();
const publicKey = fs.readFileSync('demo.rsa.pub');
const privateKey = fs.readFileSync('demo.rsa');

const app       = require('./app');
serverApp.context.app    = app;
serverApp.context.runner = app.run();

// app.use(function *(next) {
  // this.body = app.root();
// })

// request body is not always parsed (e.g., xml requests)
// function *getRequestBody(next) {
  // let len = this.request.headers['content-length'];
  // this.request.type = 'application/text';
  // var body = yield parse.text(this.request.req);
  // this.request.textbody = body;
  // yield next;
// }



// Custom 401 handling if you don't want to expose koa-jwt errors to users
function *jwtProtection(next) {
  try {
    yield next;
  } catch (err) {
    if (401 === err.status) {
      this.status = 401;
      this.body = 'Protected resource, use Authorization header to get access\n';
    } else {
      throw err;
    }
  }
}

// Public endpoint to login.
router.post('/login', function *() {
  var claims = yield parse(this);
  var token = jwt.sign(claims, privateKey, {algorithm: 'RS256'});
  this.status = 200;
  this.body = {token: token};
});

router.get('/test', function *() {
  this.response.type = 'text/json';
  this.body = {a: 3};
});

protectedRouter.get('/protectedtest', function *() {
  this.response.type = 'text/json';
  this.body = {a: 3};
});


const staticOpts = {
  maxage: 60*60
};

serverApp
  // .use(getRequestBody)
  .use(router.routes())
  .use(router.allowedMethods())
  .use(serve('www', staticOpts))
  .use(jwtProtection)
  .use(jwt({
    secret: publicKey,
    algorithm: 'RS256'
    }))
  .use(jwt({ secret: 'shared-secret'  }))
  .use(protectedRouter.routes())
  .use(protectedRouter.allowedMethods())
  ;

module.exports = serverApp;
