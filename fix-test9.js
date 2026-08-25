const fs = require('fs');
const file = 'apps/api/tests/integration/phase26e-device-collision-race.test.ts';
let code = fs.readFileSync(file, 'utf8');

// The file currently has offset -2 and -3.
// We need to change the scan_timestamp for these records so that they match the offsets.
// We'll replace `scan_timestamp: new Date().toISOString(),` with different times.

let count = 0;
code = code.replace(/scan_timestamp: new Date\(\)\.toISOString\(\),/g, (match) => {
  count++;
  if (count === 1) { // student3
    return "scan_timestamp: new Date(Date.now() - 30000).toISOString(),";
  }
  if (count === 2) { // student4
    return "scan_timestamp: new Date(Date.now() - 45000).toISOString(),";
  }
  return match;
});

fs.writeFileSync(file, code);
