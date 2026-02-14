import type { Finding, FindingCategory, SeverityLevel } from '@/lib/types'

type NewFinding = Omit<Finding, 'id' | 'created_at'>

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
  if (!hasFrontmatter && headingCount === 0) {
    findings.push({
      scan_id: scanId,
      skill_id: skillId,
      category: 'malware',
      severity: 'high',
      title: 'Missing skill structure',
      description: 'File has no YAML frontmatter and no markdown headings. Legitimate Claude Code skills use frontmatter (---) with name/description fields and markdown structure.',
      confidence: 0.8
    })
  }

  // Mostly code, very little prose — smells like a payload, not instructions
  if (codeRatio > 0.7 && totalLines > 10) {
    findings.push({
      scan_id: scanId,
      skill_id: skillId,
      category: 'malware',
      severity: 'high',
      title: 'Unusually high code-to-prose ratio',
      description: `${Math.round(codeRatio * 100)}% of non-empty lines are inside code blocks. Skills should be mostly natural-language instructions, not executable payloads.`,
      confidence: 0.7
    })
  }

  // Lots of bare shell commands outside of code blocks
  if (shellRatio > 0.5 && totalLines > 5) {
    findings.push({
      scan_id: scanId,
      skill_id: skillId,
      category: 'malware',
      severity: 'high',
      title: 'Predominantly shell commands',
      description: `${Math.round(shellRatio * 100)}% of lines look like bare shell commands outside code blocks. This resembles a shell script, not a skill file.`,
      confidence: 0.75
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

  lines.forEach((line, index) => {
    const lineNum = index + 1
    const trimmed = line.trim()
    if (!trimmed) return
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
    if (/(curl|wget)\s+[^\|]*\|\s*(ba)?sh/i.test(line) ||
        /(curl|wget)\s+[^\|]*\|\s*python/i.test(line) ||
        /(curl|wget)\s+[^\|]*\|\s*perl/i.test(line)) {
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
    if (/[A-Za-z0-9+/]{80,}={0,2}/.test(line) && !/https?:\/\//.test(line)) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'malware',
        severity: 'high',
        title: 'Embedded encoded blob',
        description: 'Contains a large base64-encoded string that may be an embedded binary or obfuscated payload.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.7
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

    // Cron/persistence mechanisms
    if (/crontab\s+/i.test(line) ||
        /\/etc\/cron/i.test(line) ||
        /systemctl\s+(enable|start)/i.test(line) ||
        /launchctl\s+load/i.test(line) ||
        /\.bashrc|\.bash_profile|\.zshrc|\.profile/i.test(line)) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'malware',
        severity: 'high',
        title: 'Persistence mechanism',
        description: 'Installs cron jobs, systemd services, launchd agents, or modifies shell profiles to survive reboots.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.8
      })
    }

    // Credential harvesting
    if (/\/etc\/shadow/i.test(line) ||
        /\/etc\/passwd/i.test(line) ||
        /\.ssh\/id_rsa/i.test(line) ||
        /\.aws\/credentials/i.test(line) ||
        /\.npmrc|\.pypirc|\.docker\/config\.json/i.test(line) ||
        /keychain|credential.helper/i.test(line)) {
      findings.push({
        scan_id: scanId,
        skill_id: skillId,
        category: 'malware',
        severity: 'critical',
        title: 'Credential file access',
        description: 'Accesses known credential storage locations (SSH keys, AWS creds, password files). Legitimate skills do not need these.',
        line_number: lineNum,
        code_snippet: snippet,
        confidence: 0.9
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
  const criticalFindings = allFindings.filter(f => f.severity === 'critical')
  const hasStructure = allFindings.every(f => f.title !== 'Missing skill structure')

  // Many critical + no skill structure = almost certainly malware
  if (!hasStructure && criticalFindings.length >= 2) {
    findings.push({
      scan_id: scanId,
      skill_id: skillId,
      category: 'malware',
      severity: 'critical',
      title: 'File appears to be malware, not a skill',
      description: `This file lacks skill structure and contains ${criticalFindings.length} critical findings including ${malwareFindings.length} malware indicators. It is likely a malicious payload disguised as a skill file.`,
      confidence: 0.9
    })
  }
  // High density of dangerous patterns even with some structure
  else if (criticalFindings.length >= 3 && malwareFindings.length >= 2) {
    findings.push({
      scan_id: scanId,
      skill_id: skillId,
      category: 'malware',
      severity: 'critical',
      title: 'Skill file has malware characteristics',
      description: `Despite having some markdown structure, this file contains ${criticalFindings.length} critical findings and ${malwareFindings.length} malware-category indicators. It may be a malicious skill.`,
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
  lines.forEach((line, index) => {
    const lineNum = index + 1
    const trimmedLine = line.trim()
    if (!trimmedLine) return

    const snippet = trimmedLine.length > 100 ? trimmedLine.substring(0, 100) + '...' : trimmedLine

    // Data exfiltration: URLs — skip markdown doc links and well-known safe domains
    const urlRegex = /https?:\/\/[^\s)>"'`\]]+/g
    const safeHostRegex = /^https?:\/\/(github\.com|gitlab\.com|npmjs\.com|docs\.|claude\.ai|anthropic\.com|x\.com|twitter\.com|basecamp\.com|stackoverflow\.com|wikipedia\.org|developer\.mozilla\.org|medium\.com|dev\.to|youtube\.com|en\.wikipedia|reddit\.com|discord\.com|slack\.com|vercel\.com|netlify\.com|supabase\.com|nodejs\.org|python\.org|rust-lang\.org|go\.dev|nextjs\.org|reactjs\.org|tailwindcss\.com|typescriptlang\.org)(\/|$)/i
    const isMarkdownLink = /\[.*?\]\(https?:\/\//.test(line)
    let match
    const urlsOnLine: string[] = []
    while ((match = urlRegex.exec(line)) !== null) {
      const url = match[0]
      // Skip safe documentation/reference domains
      if (safeHostRegex.test(url)) continue
      urlsOnLine.push(url)
    }
    // If all URLs on this line are in markdown link syntax and none are suspicious, skip
    if (urlsOnLine.length > 0 && !(isMarkdownLink && urlsOnLine.length === 0)) {
      for (const url of urlsOnLine) {
        findings.push({
          scan_id: scanId,
          skill_id: skillId,
          category: 'data_exfiltration',
          severity: 'medium',
          title: 'Network communication detected',
          description: `URL detected: ${url}`,
          line_number: lineNum,
          code_snippet: snippet,
          confidence: 0.9
        })
      }
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
    if (/(writeFile|fs\.writeFile|open\s*\(.*['"]w|[^-]>\s*\/[a-z])/i.test(line)) {
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
    if (/(rm\s+-rf|\bdd\s+if=|mkfs\s|format\s+[cC]:)/i.test(line)) {
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
