import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service - Skanzer',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <Link href="/" className="font-mono text-lg font-bold tracking-tight">
          skanzer
        </Link>
      </nav>

      <article className="px-6 py-12 max-w-3xl mx-auto">
        <h1 className="font-mono text-2xl sm:text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-brand-muted mb-10">Effective February 15, 2026</p>

        <div className="space-y-8 text-brand-muted font-sans leading-relaxed">
          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">1. Agreement</h2>
            <p>
              By accessing or using Skanzer (&ldquo;the Service&rdquo;), operated by Imagination Quotient (<a href="https://imaginationquotient.com" className="text-brand-accent hover:text-brand-accent-hover">imaginationquotient.com</a>), a DBA of Longino Consulting LLC (&ldquo;we&rdquo;, &ldquo;us&rdquo;), you agree to these Terms of Service. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">2. Description of Service</h2>
            <p>
              Skanzer is a security scanning tool that analyzes Claude Code skill files for potential security issues including data exfiltration, privilege escalation, obfuscated payloads, and behavior mismatches. The Service accepts files via direct upload, directory scan, or public GitHub repository URL.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">3. Accounts</h2>
            <p>
              You must create an account to use the Service. You are responsible for maintaining the security of your account credentials. You must provide accurate information when creating your account.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to the Service or its systems</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>Submit content that you do not have the right to analyze</li>
              <li>Use automated means to access the Service beyond its intended API</li>
              <li>Reverse engineer, decompile, or attempt to extract the source code of the Service&rsquo;s analysis engine</li>
            </ul>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">5. Content and Scans</h2>
            <p>
              You retain ownership of any files you submit for scanning. By submitting files, you grant us a limited license to process and analyze them for the purpose of providing scan results. Scan results, including findings and reports, are stored in association with your account.
            </p>
            <p className="mt-2">
              Public scan reports and repository badges may be visible to anyone with the direct URL. You are responsible for managing the visibility of your scan results.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">6. Disclaimer of Warranties</h2>
            <p>
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, either express or implied. We do not guarantee that scans will detect all security issues. A clean scan result does not certify a skill file as safe. You are solely responsible for evaluating the security of any skill files you use.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">7. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Imagination Quotient, Longino Consulting LLC, and their officers, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, arising out of or in connection with your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">8. Termination</h2>
            <p>
              We may suspend or terminate your access to the Service at any time, with or without cause, with or without notice. Upon termination, your right to use the Service ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">9. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the revised Terms. Material changes will be communicated via the Service or email.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">10. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the State of Texas, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">11. Contact</h2>
            <p>
              Questions about these Terms? Reach out to{' '}
              <a href="https://x.com/trevorlongino" className="text-brand-accent hover:text-brand-accent-hover">
                @trevorlongino on X
              </a>.
            </p>
          </section>
        </div>
      </article>

      <footer className="border-t border-brand-border px-6 py-8">
        <p className="text-center font-mono text-xs text-brand-muted">
          skanzer &mdash; built with Next.js &amp; Supabase
        </p>
      </footer>
    </div>
  )
}
