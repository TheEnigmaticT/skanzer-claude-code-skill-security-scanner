import Link from 'next/link'
import Image from 'next/image'

export const metadata = {
  title: 'Why Skanzer',
  description: 'Why Skanzer exists — the risks of blindly installing AI agent skills and why trust needs verification.',
}

export default function WhyPage() {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <Link href="/" className="font-mono text-lg font-bold tracking-tight">
          skanzer
        </Link>
      </nav>

      <article className="px-6 py-12 max-w-3xl mx-auto">
        <h1 className="font-mono text-2xl sm:text-3xl font-bold mb-10">Why Skanzer</h1>

        <div className="space-y-10 text-brand-muted font-sans leading-relaxed">
          {/* About Trevor */}
          <section className="flex flex-col sm:flex-row gap-6 items-start">
            <Image
              src="https://avatars.githubusercontent.com/u/12659201?v=4"
              alt="Trevor Longino"
              width={120}
              height={120}
              className="rounded-full shrink-0"
            />
            <div>
              <h2 className="font-mono text-lg font-bold text-brand-text mb-2">Built by Trevor Longino</h2>
              <p>
                I&rsquo;ve been a hacker and systems thinker for over 20 years. I&rsquo;m the founder of{' '}
                <a href="https://crowdtamers.com" className="text-brand-accent hover:text-brand-accent-hover">CrowdTamers</a> and{' '}
                <a href="https://imaginationquotient.com" className="text-brand-accent hover:text-brand-accent-hover">Imagination Quotient</a>,
                and lately I&rsquo;ve been building a lot of agentic software &mdash; tools where AI agents
                run code, call APIs, and modify files on your behalf.
              </p>
              <p className="mt-3">
                <a href="https://github.com/TheEnigmaticT" className="text-brand-accent hover:text-brand-accent-hover">
                  Find me on GitHub &rarr;
                </a>
              </p>
            </div>
          </section>

          {/* The problem */}
          <section>
            <h2 className="font-mono text-lg font-bold text-brand-text mb-3">The problem with &ldquo;just install it&rdquo;</h2>
            <p>
              Claude Code skills are markdown files that tell an AI agent what to do. They can instruct the agent to
              run shell commands, read and write files, make network requests, and modify system configuration.
              When you install a skill, you&rsquo;re giving it the same access that you have.
            </p>
            <p className="mt-3">
              Most skills are fine. But the ecosystem is new, growing fast, and there&rsquo;s no built-in
              vetting process. A skill that claims to &ldquo;format your code&rdquo; could just as easily
              exfiltrate your environment variables, install a backdoor, or drop a crypto miner. The
              instructions are right there in plain text &mdash; but nobody reads every line of every
              skill they install, and the malicious patterns aren&rsquo;t always obvious.
            </p>
            <p className="mt-3">
              This is the same supply chain risk that hit npm, PyPI, and browser extensions &mdash; except
              skill files don&rsquo;t go through a registry, don&rsquo;t get signed, and don&rsquo;t have
              an install step that might trigger a virus scanner. They&rsquo;re just text files that an
              agent obeys.
            </p>
          </section>

          {/* Why I built it */}
          <section>
            <h2 className="font-mono text-lg font-bold text-brand-text mb-3">Why I built Skanzer</h2>
            <p>
              I wanted something simple: a way to pre-screen skills before blindly installing them.
              Paste a GitHub URL, see what the skill actually does, and get a clear signal about whether
              it&rsquo;s doing something it shouldn&rsquo;t.
            </p>
            <p className="mt-3">
              Skanzer runs static analysis across five phases &mdash; structure validation, line-by-line
              pattern matching, malware-specific detection, behavior heuristics, and a final verdict. It
              catches data exfiltration, privilege escalation, obfuscated payloads, and mismatches between
              what a skill says it does and what it actually instructs.
            </p>
          </section>

          {/* The badge system */}
          <section>
            <h2 className="font-mono text-lg font-bold text-brand-text mb-3">The badge system: trust, but verify</h2>
            <p>
              If you maintain skills, you want people to feel confident installing them. If you use
              skills, you want some assurance that someone has actually checked what&rsquo;s in there.
              That&rsquo;s what the badge is for.
            </p>
            <p className="mt-3">
              After scanning a repository, Skanzer generates a live SVG badge you can embed in your
              README. It links to the full scan report so anyone can see exactly what was found &mdash;
              or that nothing was found. It&rsquo;s a simple, verifiable signal: this skill has been
              scanned, here are the results, judge for yourself.
            </p>
            <p className="mt-3">
              The goal isn&rsquo;t to certify skills as &ldquo;safe&rdquo; &mdash; no static analysis
              tool can guarantee that. The goal is to make the invisible visible. When skill maintainers
              scan their own repos and publish the badge, they&rsquo;re saying: &ldquo;I have nothing to
              hide. Look for yourself.&rdquo; That&rsquo;s a meaningful step toward trust in an
              ecosystem that doesn&rsquo;t have much of it yet.
            </p>
          </section>

          {/* CTA */}
          <section className="border-t border-brand-border pt-8">
            <p className="text-brand-text font-mono text-sm font-bold">
              Ready to scan?{' '}
              <Link href="/signup" className="text-brand-accent hover:text-brand-accent-hover">
                Create an account
              </Link>{' '}
              or{' '}
              <Link href="/login" className="text-brand-accent hover:text-brand-accent-hover">
                sign in
              </Link>{' '}
              to get started.
            </p>
          </section>
        </div>
      </article>

      <footer className="border-t border-brand-border px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 font-mono text-xs text-brand-muted">
          <span>skanzer &mdash; built with Next.js &amp; Supabase</span>
          <span className="hidden sm:inline">&middot;</span>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-brand-text transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-brand-text transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
