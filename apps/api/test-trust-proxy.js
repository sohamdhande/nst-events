const express = require('express');
const request = require('supertest');

const app = express();
app.set('trust proxy', 1);

app.get('/', (req, res) => {
  res.json({
    ip: req.ip,
    ips: req.ips,
    xff: req.headers['x-forwarded-for']
  });
});

request(app)
  .get('/')
  .set('X-Forwarded-For', '10.0.0.10, 5.6.7.8')
  .end((err, res) => {
    console.log(res.body);
  });
