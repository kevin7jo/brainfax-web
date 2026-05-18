import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { polygonMainnet } from './polygonChain';

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'brainfax-dev-placeholder';

if (
  typeof window !== 'undefined' &&
  !process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID &&
  process.env.NODE_ENV === 'development'
) {
  console.warn(
    '[web3] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID가 없습니다. WalletConnect는 cloud.walletconnect.com에서 Project ID를 발급하세요.'
  );
}

/** Polygon Mainnet (137) 전용 — MetaMask, WalletConnect 등 멀티 지갑 모달 */
export const wagmiConfig = getDefaultConfig({
  appName: 'BrainFax',
  projectId: walletConnectProjectId,
  chains: [polygonMainnet],
  ssr: true,
});

export { polygonMainnet };
