import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy - Skanzer',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <Link href="/" className="font-mono text-lg font-bold tracking-tight">
          skanzer
        </Link>
      </nav>

      <article className="px-6 py-12 max-w-3xl mx-auto">
        <h1 className="font-mono text-2xl sm:text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-brand-muted mb-10">Effective February 15, 2026</p>

        <div className="space-y-8 text-brand-muted font-sans leading-relaxed">
          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">1. Who We Are</h2>
            <p>
              Skanzer is operated by Imagination Quotient (<a href="https://imaginationquotient.com" className="text-brand-accent hover:text-brand-accent-hover">imaginationquotient.com</a>), a DBA of Longino Consulting LLC. This policy describes how we collect, use, and protect your information when you use skanzer.ai (&ldquo;the Service&rdquo;).
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">2. Information We Collect</h2>

            <h3 className="font-mono text-sm font-bold text-brand-text mt-4 mb-1">Account Information</h3>
            <p>
              When you create an account, we collect your email address and authentication credentials. Authentication is handled by Supabase.
            </p>

            <h3 className="font-mono text-sm font-bold text-brand-text mt-4 mb-1">Scan Data</h3>
            <p>
              When you submit files for scanning, we store the file contents, file paths, scan results, and security findings. For GitHub scans, we also store the repository owner, name, and branch.
            </p>

            <h3 className="font-mono text-sm font-bold text-brand-text mt-4 mb-1">Usage Data</h3>
            <p>
              We may collect standard server logs including IP addresses, browser type, and pages visited. This data is used to maintain and improve the Service.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide and operate the security scanning Service</li>
              <li>To store and display your scan results and reports</li>
              <li>To generate public badge images for repositories you scan</li>
              <li>To send account-related emails (confirmation, password reset)</li>
              <li>To maintain, protect, and improve the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">4. Data Storage and Security</h2>
            <p>
              Your data is stored in Supabase (hosted on AWS). We use industry-standard security measures including encrypted connections (HTTPS), row-level security policies, and secure authentication. However, no method of transmission or storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">5. Data Sharing</h2>
            <p>We do not sell your personal information. We may share data in the following limited circumstances:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong className="text-brand-text">Public reports and badges:</strong> Scan reports and repository badges are accessible via direct URL. These may include file paths, scan findings, and severity ratings.</li>
              <li><strong className="text-brand-text">Service providers:</strong> We use Supabase for database hosting and authentication, and Vercel for application hosting. These providers process data on our behalf.</li>
              <li><strong className="text-brand-text">Legal requirements:</strong> We may disclose information if required by law or to protect our rights.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">6. GitHub Data</h2>
            <p>
              When you scan a GitHub repository, we fetch file contents from public repositories (or private repositories if you provide a GitHub token). We store the contents of scanned files for analysis purposes. We do not access any GitHub data beyond what is necessary to perform the requested scan.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">7. Data Retention</h2>
            <p>
              Scan data and results are retained for as long as your account is active. You may request deletion of your account and associated data by contacting us.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">8. Your Rights</h2>
            <p>You may:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Request access to the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Withdraw consent for data processing</li>
            </ul>
            <p className="mt-2">
              To exercise these rights, reach out via the contact info below.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">9. Cookies</h2>
            <p>
              The Service uses essential cookies for authentication and session management. We do not use advertising or tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">10. Children</h2>
            <p>
              The Service is not directed at children under 13. We do not knowingly collect personal information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated effective date.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-base font-bold text-brand-text mb-2">12. Contact</h2>
            <p>
              Questions about this policy? Reach out to{' '}
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
