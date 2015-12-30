'use strict'

// for jwt: https://sendgrid.com/blog/json-web-tokens-koa-js/

const koa       = require('koa');
const parse     = require('co-body');
const serve     = require('koa-static');
const router    = require('koa-router')();
// const parse     = require('co-body');

const serverApp = koa();

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

function *requestLogger(next){
  console.log({method: this.req.method, url: this.req.url, date: new Date()});
  // console.log('%s - %s %s',new Date().toISOString(), this.req.method, this.req.url);
  yield next;
}

router.get('test', '/test', function *() {
  this.response.type = 'text/json';
  this.body = {a: 3};
});

const staticOpts = {
  maxage: 60*60
};

serverApp
  .use(requestLogger)
  // .use(getRequestBody)
  .use(router.routes)
  .use(router.allowedMethods)
  .use(serve('www', staticOpts))
  ;

module.exports = serverApp;
