import fs from 'fs';

const header = fs.readFileSync('scripts/billing-header.txt', 'utf8');
const handlers = fs.readFileSync('scripts/billing-handlers.txt', 'utf8');
const body = fs.readFileSync('scripts/billing-ui-body.txt', 'utf8');

const ui = `  return (
    <div className="space-y-6">
${body}
    </motionless>
  );
}
`.replace('    </motionless>', '    </div>');

fs.writeFileSync('app/dashboard/billing/page.tsx', header + handlers + ui, 'utf8');
console.log('assembled', fs.statSync('app/dashboard/billing/page.tsx').size);
