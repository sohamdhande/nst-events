import fs from 'fs';
let content = fs.readFileSync('apps/dashboard/tests/teams.test.tsx', 'utf8');
content = content.replace(/params=\{Promise.resolve\(\{ id: 'evt-1' \}\)\}/g, "params={mockParams}");
content = content.replace("describe('Teams Management Page', () => {", "const mockParams = Promise.resolve({ id: 'evt-1' });\n\ndescribe('Teams Management Page', () => {");
fs.writeFileSync('apps/dashboard/tests/teams.test.tsx', content);
