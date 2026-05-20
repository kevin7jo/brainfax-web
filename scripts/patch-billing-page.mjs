import fs from 'fs';

const head = fs.readFileSync('app/dashboard/billing/page.tsx', 'utf8').split('  return (')[0];

const jsx = `  return (
    <div className="space-y-6">
      <motionless />
    </div>
  );
}
`;

fs.writeFileSync('app/dashboard/billing/page.tsx', head + jsx.replace('<motionless />', '').replace('</motionless>', ''));
console.log('done');
