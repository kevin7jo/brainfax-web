'use client';

import Web3Providers from '../../../components/Web3Providers';

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return <Web3Providers>{children}</Web3Providers>;
}
