import { after } from 'node:test';
after(() => console.log('global teardown called!'));
