import type { Finding, SeverityLevel } from '@/lib/types'

export type RiskLevel = 'passed' | 'low_risk' | 'caution' | 'high_risk'

export interface BadgeData {
  repoLabel: string
  riskLevel: RiskLevel
  riskText: string
  color: string
  scanDate: string
}

export function computeRiskLevel(findings: Pick<Finding, 'severity' | 'category'>[]): RiskLevel {
  if (findings.length === 0) return 'passed'

  const hasCritical = findings.some(f => f.severity === 'critical')
  const hasMalware = findings.some(f => f.category === 'malware')
  if (hasCritical || hasMalware) return 'high_risk'

  const hasMediumOrHigh = findings.some(f => f.severity === 'medium' || f.severity === 'high')
  if (hasMediumOrHigh) return 'caution'

  return 'low_risk'
}

const RISK_CONFIG: Record<RiskLevel, { text: string; color: string; colorLight: string }> = {
  passed:    { text: 'Passed',    color: '#22c55e', colorLight: '#4ade80' },
  low_risk:  { text: 'Low Risk',  color: '#22c55e', colorLight: '#4ade80' },
  caution:   { text: 'Caution',   color: '#eab308', colorLight: '#facc15' },
  high_risk: { text: 'High Risk', color: '#ef4444', colorLight: '#f87171' },
}

export function buildBadgeData(
  repoLabel: string,
  findings: Pick<Finding, 'severity' | 'category'>[],
  scanDate: string
): BadgeData {
  const riskLevel = computeRiskLevel(findings)
  const config = RISK_CONFIG[riskLevel]
  return {
    repoLabel,
    riskLevel,
    riskText: config.text,
    color: config.color,
    scanDate,
  }
}

/**
 * Approximate text width using character count × average char width.
 * Monospace-ish estimation for the SVG layout.
 */
function textWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.6 + 10
}

export function renderBadgeSvg(data: BadgeData): string {
  const fontSize = 11
  const height = 20
  const padding = 8
  const shieldChar = '\u{1F6E1}\uFE0F' // 🛡️

  const leftText = `${data.repoLabel}`
  const middleText = data.riskText
  const rightText = data.scanDate

  const leftWidth = textWidth(leftText, fontSize) + 16 // extra for shield
  const middleWidth = textWidth(middleText, fontSize)
  const rightWidth = textWidth(rightText, fontSize)
  const totalWidth = leftWidth + middleWidth + rightWidth

  const config = RISK_CONFIG[data.riskLevel]

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" role="img" aria-label="Skanzer: ${data.repoLabel} - ${data.riskText} - ${data.scanDate}">
  <title>Skanzer: ${data.repoLabel} - ${data.riskText} - ${data.scanDate}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="${height}" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftWidth}" height="${height}" fill="#555"/>
    <rect x="${leftWidth}" width="${middleWidth}" height="${height}" fill="${config.color}"/>
    <rect x="${leftWidth + middleWidth}" width="${rightWidth}" height="${height}" fill="${config.colorLight}"/>
    <rect width="${totalWidth}" height="${height}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="${fontSize}">
    <text x="${leftWidth / 2}" y="14" fill="#010101" fill-opacity=".3">${shieldChar} ${escapeXml(leftText)}</text>
    <text x="${leftWidth / 2}" y="13">${shieldChar} ${escapeXml(leftText)}</text>
    <text x="${leftWidth + middleWidth / 2}" y="14" fill="#010101" fill-opacity=".3">${escapeXml(middleText)}</text>
    <text x="${leftWidth + middleWidth / 2}" y="13">${escapeXml(middleText)}</text>
    <text x="${leftWidth + middleWidth + rightWidth / 2}" y="14" fill="#010101" fill-opacity=".3">${escapeXml(rightText)}</text>
    <text x="${leftWidth + middleWidth + rightWidth / 2}" y="13">${escapeXml(rightText)}</text>
  </g>
</svg>`
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
