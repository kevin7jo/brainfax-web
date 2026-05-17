"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Edit2, Trash2, Mail, UserPlus } from "lucide-react"
import { supabase } from "../../../lib/supabaseClient"

type TeamMemberRow = {
  id: string
  email: string
  role: "Admin" | "Developer" | "Viewer"
  bfaxUsed: number
  status: "Active" | "Pending"
  isYou?: boolean
}

const MAX_TEAM_SIZE = 10

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMemberRow[]>([])
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<TeamMemberRow["role"]>("Viewer")
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const masterUsage = 0

  const displayRows = useMemo(() => {
    if (!userEmail) return []
    return [
      {
        id: "owner",
        email: userEmail,
        role: "Admin",
        bfaxUsed: masterUsage,
        status: "Active",
        isYou: true,
      },
      ...members,
    ]
  }, [members, userEmail])

  const totalMembers = displayRows.length
  const sharedUsage = displayRows.reduce((sum, member) => sum + member.bfaxUsed, 0)

  useEffect(() => {
    // 💡 단일 런타임 스코프 내에서 유령 소켓 채널 유출을 막는 마스터 트래커 변수
    let teamChannel: any = null
    let authSubscription: any = null
    let currentOwnerEmail: string | null = null

    const mapMember = (row: any): TeamMemberRow => ({
      id: String(row.id),
      email: row.member_email,
      role: row.role as TeamMemberRow["role"],
      bfaxUsed: Number(row.bfax_used ?? 0),
      status: row.status === "Pending" ? "Pending" : "Active",
    })

    const fetchMembers = async (ownerEmail: string) => {
      const { data, error } = await supabase
        .from("lb_team_members")
        .select("id, member_email, role, bfax_used, status")
        .eq("owner_email", ownerEmail)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Failed to load team members:", error)
        setErrorMessage("Unable to load team members right now.")
        setMembers([])
      } else {
        setErrorMessage(null)
        setMembers(data?.map(mapMember) ?? [])
      }
      setLoading(false)
    }

    const subscribeRealtime = (ownerEmail: string) => {
      // 🛡️ [선제적 방어] 동일 채널이 메모리에 남아있다면 즉각 추적 파괴하여 중복 결속 방지
      if (teamChannel) {
        supabase.removeChannel(teamChannel)
      }

      // 고유 식별 명칭으로 실시간 웹소켓 선로 개설
      teamChannel = supabase.channel(`team-members-channel-${ownerEmail}`)

      // 1. 센서(on) 선언 및 필터 결속을 완벽히 마칩니다. (순서 절대 엄수!)
      teamChannel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lb_team_members",
          filter: `owner_email=eq.${ownerEmail}`,
        },
        (payload: any) => {
          console.log("Team DB Realtime 변동 수신 완료!", payload)
          if (!payload.new && !payload.old) return

          setMembers((current: TeamMemberRow[]) => {
            if (payload.eventType === "INSERT") {
              // 중복 삽입 방지 가드
              if (current.some(m => m.id === String(payload.new.id))) return current;
              return [mapMember(payload.new), ...current]
            }

            if (payload.eventType === "UPDATE") {
              return current.map((member) =>
                member.id === String(payload.new.id) ? mapMember(payload.new) : member
              )
            }

            if (payload.eventType === "DELETE") {
              return current.filter((member) => member.id !== String(payload.old.id))
            }

            return current
          })
        }
      )

      // 2. 센서 결속이 완벽히 끝난 '최후의 순간'에 무결하게 subscribe()를 인가합니다.
      teamChannel.subscribe((status: string) => {
        console.log(`Supabase Realtime 연결 상태 통보: ${status}`)
      })
    }

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const ownerEmail = user?.email ?? null
      currentOwnerEmail = ownerEmail
      setUserEmail(ownerEmail)
      if (!ownerEmail) {
        setLoading(false)
        return
      }

      await fetchMembers(ownerEmail)
      subscribeRealtime(ownerEmail)
    }

    // 초기화 파이프라인 가동
    init().then(() => {
      authSubscription = supabase.auth.onAuthStateChange((event, session) => {
        const ownerEmail = session?.user?.email ?? null
        if (ownerEmail !== currentOwnerEmail) {
          currentOwnerEmail = ownerEmail
          setUserEmail(ownerEmail)
          if (!ownerEmail) {
            setMembers([])
            setLoading(false)
            return
          }

          setLoading(true)
          fetchMembers(ownerEmail)
          subscribeRealtime(ownerEmail)
        }
      })
    })

    // 🔒 [원자력 클린업] 컴포넌트 언마운트 및 재실행 시 유령 채널을 메모리에서 영구 박멸!
    return () => {
      if (teamChannel) {
        console.log("유령 소켓 감지: 선로 즉시 폐쇄 세척 집행!");
        supabase.removeChannel(teamChannel)
      }
      if (authSubscription?.subscription) {
        authSubscription.subscription.unsubscribe()
      }
    }
  }, [])

  const sendInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!inviteEmail || !userEmail) return

    const { error } = await supabase.from("lb_team_members").insert([
      {
        owner_email: userEmail,
        member_email: inviteEmail,
        role: inviteRole,
        bfax_used: 0,
        status: "Pending",
      },
    ])

    if (error) {
      console.error("Invite failed:", error)
      setErrorMessage("Failed to send invite. Try again.")
      return
    }

    setInviteEmail("")
    setInviteRole("Viewer")
    setErrorMessage(null)
  }

  return (
    <div className="min-h-screen p-6 bg-[#050505] text-slate-200">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Team Workspace</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">Total Team Members</p>
                <p className="text-2xl font-bold mt-1">
                  {loading ? "..." : `${totalMembers}/${MAX_TEAM_SIZE}`}
                </p>
              </div>
              <div className="flex items-center text-sm text-zinc-400">
                <UserPlus className="w-6 h-6 text-[#10b981]" />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">Shared BFAX Usage (This Month)</p>
                <p className="text-2xl font-bold mt-1">
                  {loading ? "..." : `${sharedUsage} BFAX Queue`}
                </p>
              </div>
              <div className="text-sm text-zinc-400">
                <div className="px-3 py-1 rounded-full bg-[#07160f] text-[#10b981] font-medium">#{sharedUsage}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 shadow-sm">
            <h2 className="text-lg font-medium mb-3">Invite New Member</h2>
            <form onSubmit={sendInvite} className="flex flex-col md:flex-row gap-3 items-start md:items-center">
              <input
                aria-label="Invite email"
                placeholder="member@example.com"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                className="flex-1 bg-[#070707] border border-zinc-800 rounded-md px-3 py-2 text-sm placeholder:text-zinc-500"
              />
              <select
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as TeamMemberRow["role"])}
                className="w-44 bg-[#070707] border border-zinc-800 rounded-md px-3 py-2 text-sm"
              >
                <option>Admin</option>
                <option>Developer</option>
                <option>Viewer</option>
              </select>
              <button
                type="submit"
                disabled={!inviteEmail || !userEmail}
                className="inline-flex items-center gap-2 bg-[#10b981] text-black px-4 py-2 rounded-md font-medium hover:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Mail className="w-4 h-4" />
                Send Invite
              </button>
            </form>
            {errorMessage ? <p className="mt-3 text-sm text-rose-400">{errorMessage}</p> : null}
          </div>
        </div>

        <div>
          <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-3">
              <h2 className="text-lg font-medium">Active Members</h2>
              {userEmail ? (
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Owner: {userEmail}</p>
              ) : null}
            </div>

            {loading ? (
              <div className="rounded-lg border border-zinc-800 bg-[#080808] p-6 text-sm text-zinc-400">
                Loading team members...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-auto text-sm">
                  <thead>
                    <tr className="text-zinc-400 text-left">
                      <th className="px-3 py-2">User</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">BFAX Used</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-zinc-800">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold">
                            {userEmail?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">
                              You <span className="text-zinc-400">(Admin)</span>
                            </div>
                            <div className="text-zinc-500 text-xs">{userEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-block px-2 py-1 rounded-md text-xs bg-zinc-800 text-zinc-300">Admin</span>
                      </td>
                      <td className="px-3 py-3">{masterUsage} BFAX</td>
                      <td className="px-3 py-3">
                        <span className="inline-block px-2 py-1 rounded-full text-xs bg-emerald-900 text-emerald-300">Active</span>
                      </td>
                      <td className="px-3 py-3 text-zinc-500">—</td>
                    </tr>
                    {members.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-sm text-zinc-500">
                          No team members invited yet. Invite your first team member above!
                        </td>
                      </tr>
                    ) : (
                      members.map((member) => (
                        <tr key={member.id} className="border-t border-zinc-800">
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-semibold">
                                {member.email.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium">{member.email}</div>
                                <div className="text-zinc-500 text-xs">{member.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-block px-2 py-1 rounded-md text-xs bg-zinc-800 text-zinc-300">
                              {member.role}
                            </span>
                          </td>
                          <td className="px-3 py-3">{member.bfaxUsed} BFAX</td>
                          <td className="px-3 py-3">
                            {member.status === "Active" ? (
                              <span className="inline-block px-2 py-1 rounded-full text-xs bg-emerald-900 text-emerald-300">Active</span>
                            ) : (
                              <span className="inline-block px-2 py-1 rounded-full text-xs bg-amber-900 text-amber-300">Pending</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                title="Edit"
                                className="p-2 rounded-md bg-zinc-800 hover:bg-zinc-700"
                                onClick={() => {
                                  /* edit action placeholder */
                                }}
                              >
                                <Edit2 className="w-4 h-4 text-zinc-300" />
                              </button>
                              <button
                                type="button"
                                title="Remove"
                                className="p-2 rounded-md bg-zinc-800 hover:bg-zinc-700"
                                onClick={async () => {
                                  await supabase.from("lb_team_members").delete().eq("id", member.id)
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}