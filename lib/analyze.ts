import type { Finding, FindingCategory, SeverityLevel } from '@/lib/types'

export function analyzeSkillContent(
  content: string,
  skillId: string,
  scanId: string
): Omit<Finding, 'id' | 'created_at'>[] {
  const findings: Omit<Finding, 'id' | 'created_at'>[] = []
  const lines = content.split('\n')

  // Line-by-line pattern matching
  lines.forEach((line, index) => {
    const lineNum = index + 1
    const trimmedLine = line.trim()
    if (!trimmedLine) return

    const snippet = trimmedLine.length > 100 ? trimmedLine.substring(0, 100) + '...' : trimmedLine

    // Data exfiltration: URLs (global match to catch multiple per line)
    const urlRegex = /https?:\/\/[^\s)>"'`]+/g
    let match
    while ((match = urlRegex.exec(line)) !== null) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'data_exfiltration',
        severity: 'medium',
        title: 'Network communication detected',
        description: `URL detected: ${match[0]}`,
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.9
      })
    }

    // Data exfiltration: fetch/curl/wget/axios
    if (/(fetch\(|axios\.|curl\s+|wget\s+)/i.test(line)) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'data_exfiltration',
        severity: 'medium',
        title: 'Network call detected',
        description: 'The skill contains network calls which could be used for data exfiltration.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.9
      })
    }

    // Data exfiltration: environment variable access
    if (/(?:process\.env|os\.getenv|getenv\(|os\.environ|\$[A-Z_]{2,})/i.test(line)) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'data_exfiltration',
        severity: 'high',
        title: 'Environment variable access',
        description: 'Skill accesses environment variables which may contain sensitive information.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.8
      })
    }

    // Data exfiltration: file writes (general)
    if (/(writeFile|fs\.writeFile|open\s*\(.*['"]w|>\s*[^>]+)/i.test(line)) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'data_exfiltration',
        severity: 'high',
        title: 'File write operation',
        description: 'The skill writes to files which could be used to exfiltrate data.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.7
      })
    }

    // Data exfiltration: dangerous file writes to system paths
    if (/(?:write|create|copy|move|mv|cp)\s+.*(?:\/etc\/|\/root\/|\/home\/[^/]+\/|\/var\/|\/usr\/)/i.test(line)) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'data_exfiltration',
        severity: 'high',
        title: 'Potentially dangerous file operation',
        description: 'Skill performs file write to a sensitive system directory.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.7
      })
    }

    // Privilege escalation
    if (/(?:sudo\s+|su\s+-|chmod\s+u?\+s|setuid|setgid|pkexec)/i.test(line)) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'privilege_escalation',
        severity: 'critical',
        title: 'Privilege escalation attempt',
        description: 'Skill uses commands that may elevate privileges.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.95
      })
    }

    // Privilege escalation: permission modifications
    if (/(chmod\s+|chown\s+)/i.test(line) && !/chmod\s+u?\+s/i.test(line)) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'privilege_escalation',
        severity: 'high',
        title: 'Permission modification',
        description: 'The skill modifies file permissions which could be used for privilege escalation.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.9
      })
    }

    // Behavior mismatch: destructive operations
    if (/(rm\s+-rf|dd\s+|mkfs|format\s+)/i.test(line)) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'behavior_mismatch',
        severity: 'critical',
        title: 'Destructive operation',
        description: 'The skill contains potentially destructive commands that may not match a typical skill description.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.9
      })
    }

    // Behavior mismatch: network listeners
    if (/(nc\s+-[el]|netcat\s+-[el]|socat\s+)/i.test(line)) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'behavior_mismatch',
        severity: 'high',
        title: 'Network listener',
        description: 'The skill sets up network listeners which may indicate unexpected behavior.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.9
      })
    }
  })

  // Behavior mismatch heuristic: claims safe but has findings
  if (findings.length > 0) {
    const contentLower = content.toLowerCase()
    if (contentLower.includes('safe') || contentLower.includes('harmless') || contentLower.includes('no risk')) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'behavior_mismatch',
        severity: 'medium',
        title: 'Behavior vs description mismatch',
        description: 'Skill claims to be safe but contains potentially dangerous patterns.',
        confidence: 0.6
      })
    }
  }

  return findings
}
