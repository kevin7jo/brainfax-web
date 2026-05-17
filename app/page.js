import Link from 'next/link';
import GoogleSignIn from '../components/GoogleSignIn';
import AuthRedirect from '../components/AuthRedirect';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-slate-50 p-8">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <section>
          <h1 className="text-4xl font-extrabold text-slate-900">Brainfax — AI from LocalBrain</h1>
          <p className="mt-4 text-slate-600">강력한 AI 큐 기반 처리 파이프라인을 제공하는 Brainfax의 대시보드에 오신 것을 환영합니다.</p>
          <AuthRedirect />
          <div className="mt-6">
            <GoogleSignIn />
          </div>
        </section>

        <aside className="hidden md:block p-6 bg-white rounded-xl shadow">
          <h3 className="font-semibold">Features</h3>
          <ul className="mt-3 text-slate-600 space-y-2">
            <li>- Google 소셜 로그인</li>
            <li>- 실시간 잔액 조회 (Supabase Realtime)</li>
            <li>- Vercel 배포 친화적</li>
          </ul>
          <div className="mt-6 text-sm text-slate-500">이미지나 추가 섹션을 원하시면 알려주세요.</div>
        </aside>
      </div>
    </main>
  );
}
