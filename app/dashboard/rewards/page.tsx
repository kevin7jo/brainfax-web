"use client"

import React, { useEffect, useState } from "react"
import { CheckCircle2, Sparkles, Ticket, Send, Bookmark } from "lucide-react"
import { supabase } from "../../../lib/supabaseClient"

type RewardHistoryItem = {
  id: string
  created_at: string
  activity: string
  reward_bfax: number
  status: "Success" | "Under Review" | "Approved" | "Rejected"
  review_url?: string | null
}

const statusStyles: Record<RewardHistoryItem["status"], string> = {
  Success: "bg-emerald-900 text-emerald-300",
  Approved: "bg-emerald-900 text-emerald-300",
  "Under Review": "bg-amber-900 text-amber-300",
  Rejected: "bg-rose-900 text-rose-300",
}

export default function RewardsPage() {
  const [promoCode, setPromoCode] = useState("")
  const [reviewUrl, setReviewUrl] = useState("")
  const [promoMessage, setPromoMessage] = useState("")
  const [reviewMessage, setReviewMessage] = useState("")
  const [history, setHistory] = useState<RewardHistoryItem[]>([])
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const formatDate = (value: string) => new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })

  useEffect(() => {
    // 💡 단일 스코프 내에서 유령 소켓과 인증 추적기를 제어하는 안전핀 변수
    let rewardsChannel: any = null
    let authSubscription: any = null
    let currentEmail: string | null = null

    const mapRow = (row: any): RewardHistoryItem => ({
      id: String(row.id),
      created_at: row.created_at,
      activity: row.activity,
      reward_bfax: Number(row.reward_bfax ?? 0),
      status: row.status as RewardHistoryItem["status"],
      review_url: row.review_url,
    })

    const fetchHistory = async (email: string) => {
      const { data, error } = await supabase
        .from("lb_rewards_history")
        .select("id, created_at, activity, reward_bfax, status, review_url")
        .eq("customer_email", email)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Failed to load rewards history:", error)
        setErrorMessage("Unable to load mission history right now.")
        setHistory([])
      } else {
        setErrorMessage(null)
        setHistory(data?.map(mapRow) ?? [])
      }
      setLoading(false)
    }

    const subscribeRealtime = (email: string) => {
      // 🛡️ [선제 가드] 이전에 생성된 동일 채널 유령이 있다면 즉시 파괴
      if (rewardsChannel) {
        supabase.removeChannel(rewardsChannel)
      }

      // 고유 식별 명칭으로 리워드 실시간 웹소켓 선로 개설
      rewardsChannel = supabase.channel(`rewards-history-channel-${email}`)

      // 1. 센서(.on)와 필터를 먼저 단단히 결속합니다. (순서 엄수!)
      rewardsChannel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lb_rewards_history",
          filter: `customer_email=eq.${email}`,
        },
        (payload: any) => {
          console.log("Realtime rewards change detected!", payload)
          if (!payload.new && !payload.old) return

          setHistory((current: RewardHistoryItem[]) => {
            if (payload.eventType === "INSERT") {
              // 중복 데이터 인서트 방지 가드
              if (current.some(item => item.id === String(payload.new.id))) return current;
              return [mapRow(payload.new), ...current]
            }

            if (payload.eventType === "UPDATE") {
              return current.map((item) =>
                item.id === String(payload.new.id) ? mapRow(payload.new) : item
              )
            }

            if (payload.eventType === "DELETE") {
              return current.filter((item) => item.id !== String(payload.old.id))
            }

            return current
          })
        }
      )

      // 2. 센서 결속이 완벽히 끝난 '최후의 순간'에 무결하게 subscribe() 승인 격발!
      rewardsChannel.subscribe((status: string) => {
        console.log(`Supabase Rewards Realtime 연결 상태: ${status}`)
      })
    }

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const email = user?.email ?? null
      currentEmail = email
      setUserEmail(email)

      if (!email) {
        setLoading(false)
        return
      }

      await fetchHistory(email)
      subscribeRealtime(email)
    }

    // 런타임 초기화 시퀀스 점화
    init().then(() => {
      // 인증 변경 리스너를 통한 동적 이메일 추적 보강
      authSubscription = supabase.auth.onAuthStateChange((event, session) => {
        const email = session?.user?.email ?? null
        if (email !== currentEmail) {
          currentEmail = email
          setUserEmail(email)
          if (!email) {
            setHistory([])
            setLoading(false)
            return
          }

          setLoading(true)
          fetchHistory(email)
          subscribeRealtime(email)
        }
      })
    })

    // 🔒 [원자력 클린업] 컴포넌트 언마운트 및 재실행 시 기존 수신기를 깨끗하게 소각 세척!
    return () => {
      if (rewardsChannel) {
        console.log("리워드 유령 소켓 감지: 즉시 선로 소각 청소 집행 완료!");
        supabase.removeChannel(rewardsChannel)
      }
      if (authSubscription?.subscription) {
        authSubscription.subscription.unsubscribe()
      }
    }
  }, [])

  const handleApplyPromo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!promoCode.trim() || !userEmail) {
      setPromoMessage("프로모션 코드를 입력해 주세요.")
      return
    }

    // 💡 [실전 DB 주입 확장용]: 여기에 Supabase Insert 로직을 직접 배선하시면 됩니다!
    setPromoMessage(`프로모션 코드 ${promoCode.toUpperCase()}가 적용되었습니다! 10 BFAX Queue를 즉시 충전합니다.`)
    setPromoCode("")
  }

  const handleSubmitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!reviewUrl.trim() || !userEmail) {
      setReviewMessage("리뷰 URL을 입력해 주세요.")
      return
    }

    // 💡 [실전 DB 주입 확장용]: 여기에 Supabase Insert 로직을 직접 배선하시면 됩니다!
    setReviewMessage("리뷰가 제출되었습니다. 검수 후 50 BFAX Queue가 지급됩니다.")
    setReviewUrl("")
  }

  return (
    <div className="min-h-screen p-6 bg-[#050505] text-slate-200">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Rewards & Promotions</p>
            <h1 className="text-3xl font-semibold">Earn extra BFAX with mission rewards</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-zinc-800 bg-[#101010] px-4 py-3 text-sm text-zinc-300">
            <Sparkles className="w-5 h-5 text-[#10b981]" />
            Weekly bonus missions available now
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <p className="text-sm text-zinc-400 uppercase tracking-[0.25em]">Enter Promotion Code</p>
                <h2 className="mt-2 text-2xl font-semibold">Charge bonus BFAX instantly</h2>
              </div>
              <div className="rounded-2xl bg-[#081509] p-3 text-[#10b981]">
                <Ticket className="w-6 h-6" />
              </div>
            </div>

            <form onSubmit={handleApplyPromo} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(event) => setPromoCode(event.target.value)}
                  placeholder="DEEPTECH10"
                  className="w-full rounded-2xl border border-zinc-800 bg-[#070707] px-4 py-3 text-sm text-slate-100 placeholder:text-zinc-500 focus:border-[#10b981] focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#10b981] px-5 py-3 text-sm font-semibold text-black transition hover:brightness-105"
                >
                  Apply Code
                </button>
              </div>
              <p className="text-sm text-zinc-500">예시 코드: DEEPTECH10을 입력하면 10 BFAX가 즉시 충전됩니다.</p>
              {promoMessage ? <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{promoMessage}</p> : null}
            </form>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <p className="text-sm text-zinc-400 uppercase tracking-[0.25em]">Share & Earn BFAX</p>
                <h2 className="mt-2 text-2xl font-semibold">Review Mission Panel</h2>
              </div>
              <div className="rounded-2xl bg-[#081509] p-3 text-[#10b981]">
                <Bookmark className="w-6 h-6" />
              </div>
            </div>
            <p className="text-sm leading-7 text-zinc-300">
              블로그, 카페, SNS에 BrainFax 사용 후기를 남기고 URL을 제출하시면, 검수 후 50 BFAX Queue를 보상으로 꽂아드립니다!
            </p>
            <div className="mt-5 rounded-3xl border border-zinc-800 bg-[#0b0b0b] p-5">
              <p className="text-sm font-semibold text-zinc-300">리뷰 작성 규칙</p>
              <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                <li>• 리뷰는 500자 이상 작성해야 합니다.</li>
                <li>• 필수 태그: <span className="text-[#10b981]">#BrainFax #LocalBrain</span></li>
                <li>• 솔직하고 실제 사용 경험 기반 내용이어야 합니다.</li>
              </ul>
            </div>

            <form onSubmit={handleSubmitReview} className="mt-6 space-y-4">
              <input
                type="url"
                value={reviewUrl}
                onChange={(event) => setReviewUrl(event.target.value)}
                placeholder="https://blog.example.com/review"
                className="w-full rounded-2xl border border-zinc-800 bg-[#070707] px-4 py-3 text-sm text-slate-100 placeholder:text-zinc-500 focus:border-[#10b981] focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#10b981] px-5 py-3 text-sm font-semibold text-black transition hover:brightness-105"
              >
                <Send className="w-4 h-4" />
                Submit Mission
              </button>
              {reviewMessage ? <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{reviewMessage}</p> : null}
            </form>
          </section>
        </div>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">My Mission History</p>
              <h2 className="text-2xl font-semibold">Recent reward activity</h2>
            </div>
            <div className="rounded-2xl bg-[#081509] px-4 py-2 text-sm text-[#10b981]">Latest activity</div>
          </div>

          <div className="mt-6 overflow-x-auto">
            {loading ? (
              <div className="rounded-3xl border border-zinc-800 bg-[#080808] p-6 text-sm text-zinc-400">Loading mission history...</div>
            ) : history.length === 0 ? (
              <div className="rounded-3xl border border-zinc-800 bg-[#080808] p-6 text-sm text-zinc-400">No mission history yet.</div>
            ) : (
              <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.3em] text-zinc-500">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Activity</th>
                    <th className="px-4 py-3">Reward</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} className="rounded-3xl bg-[#080808] border border-zinc-800">
                      <td className="px-4 py-4 text-slate-300">{formatDate(item.created_at)}</td>
                      <td className="px-4 py-4 text-slate-100">{item.activity}</td>
                      <td className="px-4 py-4 text-slate-200">{item.reward_bfax} BFAX</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[item.status]}`}>
                          {item.status === "Success"
                            ? "Success(🟢)"
                            : item.status === "Approved"
                            ? "Approved(🟢)"
                            : item.status === "Under Review"
                            ? "Under Review(🟡)"
                            : "Rejected(🔴)"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {errorMessage ? <p className="mt-4 text-sm text-rose-400">{errorMessage}</p> : null}
        </section>
      </div>
    </div>
  )
}