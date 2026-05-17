/** 마크다운에서 ## Response 이하 전체 본문 추출 */
export function extractResponseSection(markdown: string): string {
  const match = markdown.match(/## Response\r?\n([\s\S]*)$/)
  return match ? match[1].trim() : markdown.trim()
}
