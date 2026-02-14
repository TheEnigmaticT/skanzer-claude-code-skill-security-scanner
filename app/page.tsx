import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <span className="font-mono text-lg font-bold tracking-tight">
          skanzer
        </span>
        <Link
          href="/login"
          className="font-mono text-sm text-brand-muted hover:text-brand-text transition-colors"
        >
          sign in
        </Link>
      </nav>

      {/* Hero — left-aligned, no dark bg, no glow, no grid */}
      <section className="px-6 pt-16 pb-24 max-w-5xl mx-auto">
        <h1 className="font-mono text-3xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.15] max-w-2xl">
          Know what a skill actually does before you run it.
        </h1>

        <p className="mt-6 text-lg text-brand-muted max-w-lg leading-relaxed font-sans">
          Skanzer reads Claude Code skill files and flags data exfiltration,
          privilege escalation, obfuscated payloads, and behavior that
          doesn&apos;t match what the skill claims to do.
        </p>

        <Link
          href="/signup"
          className="mt-8 inline-flex items-center font-mono text-sm font-bold bg-brand-accent text-white px-6 py-3 hover:bg-brand-accent-hover transition-colors"
        >
          Start scanning
        </Link>
      </section>

      {/* What we catch — oversized numbers as structural design */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <div className="border-t border-brand-border pt-16">
          {[
            {
              num: "01",
              title: "Data exfiltration",
              desc: "Outbound fetch calls, curl to unknown hosts, environment variable reads, file writes outside the workspace. If a skill is phoning home, we find it.",
            },
            {
              num: "02",
              title: "Privilege escalation",
              desc: "sudo invocations, chmod +s, permission modifications, and bash commands that reach beyond what any skill legitimately needs.",
            },
            {
              num: "03",
              title: "Obfuscated payloads",
              desc: "Base64-encoded commands, reversed strings, eval chains, dropper patterns, cron persistence, and crypto miners hiding in plain sight.",
            },
            {
              num: "04",
              title: "Behavior mismatch",
              desc: "A skill that says it formats code but runs rm -rf. A skill that claims to lint but opens a reverse shell. We compare stated purpose against actual instructions.",
            },
          ].map((item, i) => (
            <div
              key={item.num}
              className={`flex flex-col sm:flex-row gap-4 sm:gap-12 sm:items-baseline ${
                i > 0 ? "mt-10 sm:mt-12" : ""
              }`}
            >
              <span className="font-mono text-5xl sm:text-8xl font-bold text-brand-accent-mid select-none leading-none shrink-0">
                {item.num}
              </span>
              <div>
                <h2 className="font-mono text-lg font-bold">{item.title}</h2>
                <p className="mt-2 text-brand-muted leading-relaxed max-w-lg font-sans">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works — stacked, not bento */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
        <div className="border-t border-brand-border pt-16">
          <h2 className="font-mono text-2xl font-bold mb-10">How it works</h2>

          <div className="grid sm:grid-cols-2 gap-x-16 gap-y-8">
            <div>
              <p className="font-mono text-sm font-bold text-brand-accent mb-1">Upload</p>
              <p className="text-brand-muted font-sans leading-relaxed">
                Drop a .md skill file, point at a directory, or paste a GitHub repo URL.
                We pull every markdown file and queue them for analysis.
              </p>
            </div>
            <div>
              <p className="font-mono text-sm font-bold text-brand-accent mb-1">Analyze</p>
              <p className="text-brand-muted font-sans leading-relaxed">
                Five-phase static analysis: structure validation, line-by-line pattern
                matching, malware-specific detection, behavior heuristics, and a
                final verdict.
              </p>
            </div>
            <div>
              <p className="font-mono text-sm font-bold text-brand-accent mb-1">Report</p>
              <p className="text-brand-muted font-sans leading-relaxed">
                Every scan produces a public report page with findings grouped by
                category, severity badges, code snippets, and confidence scores.
              </p>
            </div>
            <div>
              <p className="font-mono text-sm font-bold text-brand-accent mb-1">Badge</p>
              <p className="text-brand-muted font-sans leading-relaxed">
                Embed a live SVG badge in your README. It links directly to the dated
                report so anyone can verify the scan themselves.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-brand-border px-6 py-8">
        <p className="text-center font-mono text-xs text-brand-muted">
          skanzer &mdash; built with Next.js &amp; Supabase
        </p>
      </footer>
    </div>
  );
}
