'use-strict';

const serverApp = require('./server-app');

const port = (process.argv[2] || process.env.PORT || 3007);

if (!module.parent) {
  serverApp.listen(port);
  console.log('listening at http://localhost:' + port + '/');
}

