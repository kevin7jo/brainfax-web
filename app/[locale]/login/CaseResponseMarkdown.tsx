"use client"

import React, { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { extractResponseSection } from "../../../lib/extractResponse"

type Props = {
  caseFile: string
}

export default function CaseResponseMarkdown({ caseFile }: Props) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/cases/${caseFile}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${caseFile}`)
        return res.text()
      })
      .then((md) => {
        if (!cancelled) {
          setContent(extractResponseSection(md))
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed")
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [caseFile])

  if (loading) {
    return (
      <p className="text-zinc-500 text-[11px] animate-pulse py-4">Response 로딩 중…</p>
    )
  }

  if (error) {
    return <p className="text-red-400 text-[11px] py-2">{error}</p>
  }

  if (!content) {
    return <p className="text-zinc-500 text-[11px] py-2">Response 내용이 없습니다.</p>
  }

  return (
    <div className="case-response-markdown mt-2 max-h-[min(70vh,720px)] overflow-y-auto pr-1 text-[11px] leading-relaxed text-zinc-300 [&_h3]:text-[#10b981] [&_h3]:font-bold [&_h3]:text-xs [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_hr]:border-zinc-800 [&_hr]:my-3 [&_strong]:text-slate-200 [&_code]:text-[#10b981] [&_code]:bg-zinc-900 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-[#050505] [&_pre]:border [&_pre]:border-zinc-900 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:my-2 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_table]:text-[10px] [&_th]:border [&_th]:border-zinc-800 [&_th]:bg-zinc-900 [&_th]:p-1.5 [&_th]:text-left [&_td]:border [&_td]:border-zinc-800 [&_td]:p-1.5">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
