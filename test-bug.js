import { after } from 'node:test';
after(async () => {
  await new Promise(r => setTimeout(r, 10));
});
