import fs from 'fs';
let content = fs.readFileSync('apps/dashboard/tests/teams.test.tsx', 'utf8');

// First replace console.log
content = content.replace("console.log(document.body.innerHTML); ", "");

// Make all `it` callbacks async
content = content.replace(/it\('([^']+)', \(\) => \{/g, "it('$1', async () => {");

// Wrap expect(screen...) in await waitFor(() => ...)
content = content.replace(/expect\(screen\.(getAllByText|getByText|queryByText)([^;]+);/g, "await waitFor(() => expect(screen.$1$2);");

fs.writeFileSync('apps/dashboard/tests/teams.test.tsx', content);
