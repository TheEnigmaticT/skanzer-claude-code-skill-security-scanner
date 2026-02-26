import type { Finding, FindingCategory, SeverityLevel } from '@/lib/types'

type NewFinding = Omit<Finding, 'id' | 'created_at'>

/**
 * Extract a meaningful skill name from skill file content.
 * Checks YAML frontmatter `name:` field first, then falls back to the first
 * markdown heading (# ...).  Returns null if nothing useful is found.
 */
export function extractSkillName(content: string): string | null {
  // Try YAML frontmatter  name: field
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (fmMatch) {
    const nameMatch = fmMatch[1].match(/^name:\s*(.+)/m)
    if (nameMatch) {
      const name = nameMatch[1].trim().replace(/^["']|["']$/g, '')
      if (name.length > 0) return name
    }
  }

  // Fall back to first markdown heading
  const headingMatch = content.match(/^#{1,6}\s+(.+)/m)
  if (headingMatch) {
    const name = headingMatch[1].trim()
    if (name.length > 0) return name
  }

  return null
}

/**
 * Check whether this file looks like a legitimate Claude Code skill
 * (markdown with frontmatter / headings / prose) vs raw code / commands.
 */
function checkSkillStructure(
  content: string,
  skillId: string,
  scanId: string
): NewFinding[] {
  const findings: NewFinding[] = []

  const hasFrontmatter = /^---\s*\n[\s\S]*?\n---/m.test(content)
  const headingCount = (content.match(/^#{1,6}\s+.+/gm) || []).length
  const lines = content.split('\n').filter(l => l.trim().length > 0)
  const totalLines = lines.length

  if (totalLines === 0) return findings

  // Count lines that are inside fenced code blocks
  let inCodeBlock = false
  let codeLines = 0
  for (const line of content.split('\n')) {
    if (/^```/.test(line.trim())) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) codeLines++
  }

  // Count lines that look like shell commands (outside code blocks)
  let shellCommandLines = 0
  inCodeBlock = false
  for (const line of content.split('\n')) {
    if (/^```/.test(line.trim())) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (!inCodeBlock && /^\s*(\$\s+|#!\s*\/|[a-z_]+\s*=|&&|;\s*[a-z])/.test(line)) {
      shellCommandLines++
    }
  }

  const codeRatio = codeLines / totalLines
  const shellRatio = shellCommandLines / totalLines

  // No frontmatter AND no markdown headings — doesn't look like a skill
  // Downgraded: some simple skills may omit structure; only suspicious on its own
  if (!hasFrontmatter && headingCount === 0) {
    findings.push({
      scan_id: scanId,
      skill_id: skillId,
      category: 'other',
      severity: 'medium',
      title: 'Missing skill structure',
      description: 'File has no YAML frontmatter and no markdown headings. Legitimate Claude Code skills use frontmatter (---) with name/description fields and markdown structure.',
      confidence: 0.7
    })
  }

  // Mostly code, very little prose — smells like a payload, not instructions
  // Raised threshold: many legitimate skills are code-heavy (tutorials, devops)
  if (codeRatio > 0.85 && totalLines > 10) {
    findings.push({
      scan_id: scanId,
      skill_id: skillId,
      category: 'malware',
      severity: 'medium',
      title: 'Unusually high code-to-prose ratio',
      description: `${Math.round(codeRatio * 100)}% of non-empty lines are inside code blocks. Skills should be mostly natural-language instructions, not executable payloads.`,
      confidence: 0.6
    })
  }

  // Lots of bare shell commands outside of code blocks
  if (shellRatio > 0.65 && totalLines > 5) {
    findings.push({
      scan_id: scanId,
      skill_id: skillId,
      category: 'malware',
      severity: 'medium',
      title: 'Predominantly shell commands',
      description: `${Math.round(shellRatio * 100)}% of lines look like bare shell commands outside code blocks. This resembles a shell script, not a skill file.`,
      confidence: 0.65
    })
  }

  return findings
}

/**
 * Detect obfuscation techniques and known malware patterns.
 */
function checkMalwarePatterns(
  content: string,
  skillId: string,
  scanId: string
): NewFinding[] {
  const findings: NewFinding[] = []
  const lines = content.split('\n')
  let inCode = false

  lines.forEach((line, index) => {
    const lineNum = index + 1
    const trimmed = line.trim()
    if (/^```/.test(trimmed)) {
      inCode = !inCode
      return
    }
    if (!trimmed) return
    // Malware patterns in prose are mostly just documentation/discussion —
    // only flag patterns found inside code blocks
    if (!inCode) return
    const snippet = trimmed.length > 100 ? trimmed.substring(0, 100) + '...' : trimmed

    // Reverse shells
    if (/\/dev\/tcp\//i.test(line) ||
        /bash\s+-i\s+>&?\s*\/dev\//i.test(line) ||
        /python[23]?\s+-c\s+.*import\s+socket/i.test(line) ||
        /perl\s+-e\s+.*socket/i.test(line) ||
        /ruby\s+-rsocket/i.test(line) ||
        /php\s+-r\s+.*fsockopen/i.test(line)) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'malware',
        severity: 'critical',
        title: 'Reverse shell detected',
        description: 'This line contains a reverse shell pattern commonly used to establish unauthorized remote access.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.95
      })
    }

    // Curl/wget piped to shell (dropper pattern)
    // Exclude safe pipe targets: jq, grep, head, tail, less, wc, sort, python -m json.tool, etc.
    const safePipeTargets = /\|\s*(jq|grep|head|tail|less|more|wc|sort|uniq|tee|cat|python[23]?\s+-m\s+json\.tool)\b/i
    if (!safePipeTargets.test(line) && (
        /(curl|wget)\s+[^\|]*\|\s*(ba)?sh/i.test(line) ||
        /(curl|wget)\s+[^\|]*\|\s*python/i.test(line) ||
        /(curl|wget)\s+[^\|]*\|\s*perl/i.test(line))) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'malware',
        severity: 'critical',
        title: 'Download-and-execute pattern',
        description: 'Downloads remote content and pipes it directly to an interpreter. This is a classic malware dropper technique.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.95
      })
    }

    // Obfuscated payloads: base64 decode + execute
    if (/base64\s+(-d|--decode)/i.test(line) ||
        /atob\s*\(/i.test(line) ||
        /Buffer\.from\s*\([^)]*,\s*['"]base64['"]\s*\)/i.test(line)) {
      // Only flag if near an execution context
      if (/\|\s*(ba)?sh/i.test(line) || /eval/i.test(line) || /exec/i.test(line) || /python/i.test(line)) {
        findings.push({
          scan_id: scanId,
          skill_id: skillId,
          category: 'malware',
          severity: 'critical',
          title: 'Encoded payload execution',
          description: 'Base64 content is decoded and executed. This is a common obfuscation technique to hide malicious commands.',
          line_number: lineNum,
          code_snippet: snippet,
          confidence: 0.9
        })
      }
    }

    // Standalone eval/exec of dynamic content
    if (/eval\s*\(\s*("|'|`|\$|atob|Buffer|String\.fromCharCode)/i.test(line) ||
        /exec\s*\(\s*("|'|`|\$|atob|Buffer|String\.fromCharCode)/i.test(line)) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'malware',
        severity: 'critical',
        title: 'Dynamic code execution',
        description: 'Uses eval() or exec() with constructed strings, a common technique to hide malicious intent.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.85
      })
    }

    // Large base64 blobs (likely embedded binary/payload)
    // Raised threshold to 200 chars — short base64 strings are common in
    // configs, data URIs, and image references
    if (/[A-Za-z0-9+/]{200,}={0,2}/.test(line) && !/https?:\/\//.test(line) && !/data:image\//i.test(line)) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'malware',
        severity: 'medium',
        title: 'Embedded encoded blob',
        description: 'Contains a large base64-encoded string that may be an embedded binary or obfuscated payload.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.6
      })
    }

    // Hex-encoded payloads
    if (/\\x[0-9a-f]{2}(\\x[0-9a-f]{2}){10,}/i.test(line) ||
        /String\.fromCharCode\s*\(\s*\d+\s*(,\s*\d+\s*){5,}\)/i.test(line)) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'malware',
        severity: 'high',
        title: 'Hex-encoded or charcode payload',
        description: 'Contains hex-encoded bytes or String.fromCharCode sequences commonly used to obfuscate malicious code.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.8
      })
    }

    // Crypto mining
    if (/stratum\+tcp:\/\//i.test(line) ||
        /xmrig|minerd|cgminer|bfgminer|cpuminer/i.test(line) ||
        /cryptonight|randomx|ethash/i.test(line)) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'malware',
        severity: 'critical',
        title: 'Cryptocurrency mining detected',
        description: 'References to mining software, protocols, or algorithms. This is not a legitimate skill function.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.95
      })
    }

    // Persistence mechanisms — distinguish between system-level persistence
    // (cron, systemd, launchd) and simple shell profile references
    if (/crontab\s+/i.test(line) ||
        /\/etc\/cron/i.test(line) ||
        /launchctl\s+load/i.test(line)) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'malware',
        severity: 'high',
        title: 'Persistence mechanism',
        description: 'Installs cron jobs or launchd agents to survive reboots.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.8
      })
    }
    // systemctl enable/start is common in devops — flag at medium
    else if (/systemctl\s+(enable|start)/i.test(line)) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'behavior_mismatch',
        severity: 'medium',
        title: 'Service management',
        description: 'Enables or starts system services. Common in deployment but worth reviewing.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.6
      })
    }
    // Shell profile references are very common in setup/config skills
    else if (/\.bashrc|\.bash_profile|\.zshrc|\.profile/i.test(line)) {
      // Only flag if writing to profile (not just reading/sourcing)
      if (/(>>|>\s*~|echo\s+.*>>|tee\s+-a)/i.test(line)) {
        findings.push({
          scan_id: scanId,
          skill_id: skillId,
          category: 'behavior_mismatch',
          severity: 'medium',
          title: 'Shell profile modification',
          description: 'Writes to shell profile files. Common in setup scripts but could be used for persistence.',
          line_number: lineNum,
          code_snippet: snippet,
          confidence: 0.65
        })
      }
    }

    // Credential file access — distinguish between truly dangerous system
    // files (shadow) and config files that security/devops skills may reference
    const dangerousCredFiles = /\/etc\/shadow/i.test(line)
    const sensitiveCredFiles = /\/etc\/passwd|\.ssh\/id_rsa|\.aws\/credentials|\.npmrc|\.pypirc|\.docker\/config\.json/i.test(line)
    const credHelpers = /keychain|credential\.helper/i.test(line)
    if (dangerousCredFiles) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'malware',
        severity: 'critical',
        title: 'Password file access',
        description: 'Accesses /etc/shadow (password hashes). This is almost never legitimate in a skill.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.95
      })
    } else if (sensitiveCredFiles) {
      // Only critical if combined with network exfiltration
      const hasExfil = /(curl|wget|fetch|axios|requests\.|http\.get|nc\s)/i.test(line)
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: hasExfil ? 'malware' : 'data_exfiltration',
        severity: hasExfil ? 'critical' : 'high',
        title: 'Credential file access',
        description: hasExfil
          ? 'Reads credential files and appears to send them over the network.'
          : 'References credential file paths. May be legitimate for security scanning or configuration.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: hasExfil ? 0.9 : 0.7
      })
    } else if (credHelpers) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'data_exfiltration',
        severity: 'medium',
        title: 'Credential helper reference',
        description: 'References credential helpers. Common in git configuration contexts.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.5
      })
    }

    // Disabling security tools
    if (/ufw\s+disable/i.test(line) ||
        /setenforce\s+0/i.test(line) ||
        /iptables\s+-F/i.test(line) ||
        /systemctl\s+(stop|disable)\s+(firewalld|apparmor|selinux)/i.test(line) ||
        /kill\s+.*antivirus|kill\s+.*defender/i.test(line)) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'malware',
        severity: 'critical',
        title: 'Security tool tampering',
        description: 'Attempts to disable firewalls, SELinux, AppArmor, or security software. This is a hallmark of malware.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.95
      })
    }
  })

  return findings
}

/**
 * After all checks, decide if the overall profile says "malware" vs "risky skill".
 */
function checkOverallVerdict(
  content: string,
  allFindings: NewFinding[],
  skillId: string,
  scanId: string
): NewFinding[] {
  const findings: NewFinding[] = []
  const lines = content.split('\n').filter(l => l.trim().length > 0)
  if (lines.length === 0) return findings

  const malwareFindings = allFindings.filter(f => f.category === 'malware')
  // Only count high-confidence critical findings for the verdict
  const highConfCritical = allFindings.filter(f => f.severity === 'critical' && (f.confidence ?? 0) >= 0.85)
  const hasStructure = allFindings.every(f => f.title !== 'Missing skill structure')

  // Many high-confidence critical + no skill structure = almost certainly malware
  if (!hasStructure && highConfCritical.length >= 2) {
    findings.push({
      scan_id: scanId,
      skill_id: skillId,
      category: 'malware',
      severity: 'critical',
      title: 'File appears to be malware, not a skill',
      description: `This file lacks skill structure and contains ${highConfCritical.length} high-confidence critical findings including ${malwareFindings.length} malware indicators. It is likely a malicious payload disguised as a skill file.`,
      confidence: 0.9
    })
  }
  // High density of dangerous patterns even with some structure
  else if (highConfCritical.length >= 3 && malwareFindings.length >= 2) {
    findings.push({
      scan_id: scanId,
      skill_id: skillId,
      category: 'malware',
      severity: 'critical',
      title: 'Skill file has malware characteristics',
      description: `Despite having some markdown structure, this file contains ${highConfCritical.length} high-confidence critical findings and ${malwareFindings.length} malware-category indicators. It may be a malicious skill.`,
      confidence: 0.8
    })
  }

  return findings
}

/**
 * Main analysis entry point. Runs all checks:
 * 1. Skill structure validation
 * 2. Line-by-line security pattern matching
 * 3. Malware-specific pattern detection
 * 4. Behavior-mismatch heuristics
 * 5. Overall malware verdict
 */
export function analyzeSkillContent(
  content: string,
  skillId: string,
  scanId: string
): NewFinding[] {
  const findings: NewFinding[] = []
  const lines = content.split('\n')

  // --- Phase 1: Skill structure check ---
  findings.push(...checkSkillStructure(content, skillId, scanId))

  // --- Phase 2: Line-by-line security patterns ---
  let inCode = false
  lines.forEach((line, index) => {
    const lineNum = index + 1
    const trimmedLine = line.trim()

    // Track fenced code blocks
    if (/^```/.test(trimmedLine)) {
      inCode = !inCode
      return
    }
    if (!trimmedLine) return

    const snippet = trimmedLine.length > 100 ? trimmedLine.substring(0, 100) + '...' : trimmedLine

    // Data exfiltration: URLs
    // Prose/markdown links are not executable — only flag URLs in code blocks
    // or lines with an executable context (curl, wget, fetch, etc.)
    // Skip well-known safe domains (docs, package registries, official APIs)
    const urlRegex = /https?:\/\/[^\s)>"'`\]]+/g
    const safeDomains = /^https?:\/\/(github\.com|api\.github\.com|gitlab\.com|npmjs\.com|registry\.npmjs\.org|pypi\.org|crates\.io|docs\.|stackoverflow\.com|developer\.mozilla\.org|wiki\.|example\.com|localhost|127\.0\.0\.1)/i
    const hasExecContext = /(curl|wget|fetch\(|axios\.|requests\.|http\.get|\.download|invoke-webrequest)/i.test(line)
    let match
    if (inCode && hasExecContext) {
      while ((match = urlRegex.exec(line)) !== null) {
        if (safeDomains.test(match[0])) continue
        findings.push({
          scan_id: scanId,
          skill_id: skillId,
          category: 'data_exfiltration',
          severity: 'medium',
          title: 'URL in executable context',
          description: `URL detected in ${inCode ? 'code block' : 'command context'}: ${match[0]}`,
          line_number: lineNum,
          code_snippet: snippet,
          confidence: 0.7
        })
      }
    }

    // Data exfiltration: fetch/curl/wget/axios — only in code blocks
    if (inCode && /(fetch\(|axios\.|curl\s+|wget\s+)/i.test(line)) {
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

    // Data exfiltration: environment variable access — only in code blocks
    // Only flag as high if combined with network exfiltration on the same line;
    // otherwise it's likely normal app configuration
    if (inCode && /(?:process\.env|os\.getenv|getenv\(|os\.environ)/i.test(line)) {
      const envWithNetwork = /(fetch|curl|wget|axios|requests\.|http\.get)/i.test(line)
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'data_exfiltration',
        severity: envWithNetwork ? 'high' : 'low',
        title: 'Environment variable access',
        description: envWithNetwork
          ? 'Skill reads environment variables and sends them over the network — potential data exfiltration.'
          : 'Skill accesses environment variables, likely for configuration.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: envWithNetwork ? 0.85 : 0.5
      })
    }

    // Data exfiltration: file writes (general) — only in code blocks
    if (inCode && /(writeFile|fs\.writeFile|open\s*\(.*['"]w|[^-]>\s*\/[a-z])/i.test(line)) {
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

    // Data exfiltration: dangerous file writes to system paths — only in code blocks
    if (inCode && /(?:write|create|copy|move|mv|cp)\s+.*(?:\/etc\/|\/root\/|\/home\/[^/]+\/|\/var\/|\/usr\/)/i.test(line)) {
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

    // Privilege escalation — only in code blocks
    if (inCode && /(?:sudo\s+|su\s+-|chmod\s+u?\+s|setuid|setgid|pkexec)/i.test(line)) {
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

    // Privilege escalation: permission modifications — only in code blocks
    // chmod/chown are routine in devops; only setuid is truly dangerous (caught above)
    if (inCode && /(chmod\s+|chown\s+)/i.test(line) && !/chmod\s+u?\+s/i.test(line)) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'privilege_escalation',
        severity: 'medium',
        title: 'Permission modification',
        description: 'The skill modifies file permissions. This is common in deployment scripts but worth noting.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.6
      })
    }

    // Behavior mismatch: destructive operations — only in code blocks
    if (inCode && /(rm\s+-rf|\bdd\s+if=|mkfs\s|format\s+[cC]:)/i.test(line)) {
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

    // Behavior mismatch: network listeners — only in code blocks
    if (inCode && /(nc\s+-[el]|netcat\s+-[el]|socat\s+)/i.test(line)) {
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

  // --- Phase 3: Malware-specific patterns ---
  findings.push(...checkMalwarePatterns(content, skillId, scanId))

  // --- Phase 4: Behavior-mismatch heuristic ---
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

  // --- Phase 5: Overall verdict ---
  findings.push(...checkOverallVerdict(content, findings, skillId, scanId))

  return findings
}
