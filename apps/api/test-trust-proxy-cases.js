const express = require('express');
const request = require('supertest');
const app = express();
app.set('trust proxy', 1);
app.get('/', (req, res) => res.json({ ip: req.ip, ips: req.ips, xff: req.headers['x-forwarded-for'] }));

request(app)
  .get('/')
  .set('X-Forwarded-For', '1.2.3.4, 5.6.7.8, 1.2.3.4')
  .end((err, res) => console.log('CASE 2:', res.body));

request(app)
  .get('/')
  .set('X-Forwarded-For', '10.0.0.10, 5.6.7.8')
  .end((err, res) => console.log('CASE 4:', res.body));

request(app)
  .get('/')
  .set('X-Forwarded-For', '10.0.0.10, 20.0.0.20, 30.0.0.30, 5.6.7.8')
  .end((err, res) => console.log('CASE 5:', res.body));
