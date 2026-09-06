const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/v1/events/e569785c-f6eb-409a-966a-b7bc5ce17491/teams',
  method: 'GET',
};

const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
