const { Client } = require('pg');
async function run() {
  const c = new Client();
  console.log('ending...');
  await c.end();
  console.log('ended!');
}
run();
