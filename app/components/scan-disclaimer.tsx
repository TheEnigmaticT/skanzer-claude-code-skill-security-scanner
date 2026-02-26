'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'skanzer_disclaimer_seen'

export default function ScanDisclaimer() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-brand-surface border border-brand-border max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 sm:p-10">
        <h1 className="font-mono text-2xl sm:text-3xl font-bold text-brand-text mb-6">
          What does this mean?
        </h1>

        <p className="text-brand-muted mb-6 leading-relaxed">
          Heads up &mdash; we&rsquo;re telling you what these skills do and where they send
          information. That <span className="text-brand-text font-medium">may be expected behavior</span> for
          the skill you&rsquo;re looking at.
        </p>

        <div className="space-y-5 mb-8">
          {/* Low */}
          <div className="flex gap-4">
            <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-20 h-6 bg-green-100 text-green-800 font-mono text-xs font-bold">
              LOW
            </span>
            <p className="text-brand-muted leading-relaxed">
              <span className="text-brand-text font-medium">Low-risk files do not move or
              transport any data outside of your device.</span> These are generally safe to use
              as-is.
            </p>
          </div>

          {/* Medium */}
          <div className="flex gap-4">
            <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-20 h-6 bg-yellow-100 text-yellow-800 font-mono text-xs font-bold">
              MEDIUM
            </span>
            <p className="text-brand-muted leading-relaxed">
              <span className="text-brand-text font-medium">Medium-risk files may transport data,
              but you may also expect that.</span> For example, a skill that calls an API on your
              behalf will show up here. Review the findings to confirm the behavior matches what
              you expect.
            </p>
          </div>

          {/* High / Critical */}
          <div className="flex gap-4">
            <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-20 h-6 bg-red-100 text-red-800 font-mono text-xs font-bold">
              HIGH
            </span>
            <p className="text-brand-muted leading-relaxed">
              <span className="text-brand-text font-medium">High-risk files can download, install,
              and execute software without your explicit permission.</span> These deserve careful
              review before you decide to use them.
            </p>
          </div>
        </div>

        <div className="border-t border-brand-border pt-6 mb-8">
          <p className="text-brand-muted leading-relaxed">
            Our job is to flag these things so you don&rsquo;t have to read through the entire
            skill file yourself. Instead, you can see where your data might be transported and
            what actions the skill can take. <span className="text-brand-text font-medium">It&rsquo;s
            up to you to make the right call</span> on whether this is a skill you want to use
            or not.
          </p>
        </div>

        <button
          onClick={dismiss}
          className="w-full font-mono text-sm font-bold bg-brand-accent text-white px-6 py-3 hover:bg-brand-accent-hover transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
