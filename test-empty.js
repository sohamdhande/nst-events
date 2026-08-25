import fs from 'fs';
const content = fs.readFileSync('apps/dashboard/tests/teams.test.tsx', 'utf8');
const newContent = content.replace(
  "expect(screen.getAllByText(/No teams have been created/i).length).toBeGreaterThan(0);",
  "console.log(document.body.innerHTML); expect(screen.getAllByText(/No teams have been created/i).length).toBeGreaterThan(0);"
);
fs.writeFileSync('apps/dashboard/tests/teams.test.tsx', newContent);
