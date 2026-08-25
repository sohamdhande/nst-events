import fs from 'fs';
let content = fs.readFileSync('apps/dashboard/tests/teams.test.tsx', 'utf8');

// replace render(<TeamsManagementPage... with await act(async () => { render(...) });
content = content.replace(/render\(<TeamsManagementPage params=\{mockParams\} \/>, \{ wrapper: Wrapper(.*?)\}\);/g, "await act(async () => { render(<TeamsManagementPage params={mockParams} />, { wrapper: Wrapper$1}); });");

// Add import { act } if not there
if (!content.includes('act } from')) {
    content = content.replace("import { render, screen, waitFor, fireEvent } from '@testing-library/react';", "import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';");
}

fs.writeFileSync('apps/dashboard/tests/teams.test.tsx', content);
