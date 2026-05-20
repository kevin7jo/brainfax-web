import fs from 'fs';

const page = fs.readFileSync('app/dashboard/billing/page.tsx', 'utf8');
const head = page.split('  useEffect(() => {\n    if (!userEmail) return;')[0];
const handlers = fs.readFileSync('scripts/billing-handlers.txt', 'utf8');
const body = fs.readFileSync('scripts/billing-ui-body.txt', 'utf8');

const effect = `  useEffect(() => {
    if (!userEmail) return;

    const balanceChannel = supabase
      .channel(\`user_balance_\${userEmail}\`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lb_user_balance',
          filter: \`customer_email=eq.\${userEmail}\`,
        },
        (payload) => {
          const newRow = payload.new as { bfax_queue?: number; bfax_amount?: number } | null;
          if (newRow) setBalance(readBalanceFromRow(newRow));
        }
      )
      .subscribe();

    const historyChannel = supabase
      .channel(\`recharge_history_\${userEmail}\`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lb_recharge_history',
          filter: \`customer_email=eq.\${userEmail}\`,
        },
        () => fetchHistory(userEmail)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(balanceChannel);
      supabase.removeChannel(historyChannel);
    };
  }, [userEmail, fetchHistory]);
`;

const ui = `  return (
    <div className="space-y-6">
${body}
    </div>
  );
}
`;

fs.writeFileSync('app/dashboard/billing/page.tsx', head + effect + handlers + ui, 'utf8');
console.log('rebuilt');
