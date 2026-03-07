import { useInView } from './useInView'
import GmailConnect from '../GmailConnect'

interface FinalCTAProps {
  onError: (message: string) => void
  onDemoClick: () => void
}

export default function FinalCTA({ onError, onDemoClick }: FinalCTAProps) {
  const [ref, inView] = useInView(0.15)

  return (
    <section
      ref={ref as React.RefObject<HTMLDivElement>}
      className="relative py-20 md:py-40 px-6 overflow-hidden noise-overlay"
    >
      <div className={`relative max-w-2xl mx-auto text-center transition-all duration-1000 ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}>
        <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
          Your travel story awaits
        </h2>
        <p className="text-gray-400 text-lg mb-10">
          Takes about 30 seconds. Your emails never leave your browser.
        </p>

        <div className="flex flex-col items-center gap-5">
          <GmailConnect onError={onError} />
          <button
            onClick={onDemoClick}
            className="text-gray-400 hover:text-white transition-all duration-300 text-sm font-medium px-5 py-2.5 hover:bg-white/5"
          >
            Or try with sample data &rarr;
          </button>
        </div>

        <div className="flex items-center justify-center gap-3 text-xs text-gray-500 mt-6 flex-wrap">
          <span>Read-only access</span>
          <span className="w-1 h-1 bg-gray-700" />
          <span>Nothing stored</span>
          <span className="w-1 h-1 bg-gray-700" />
          <span>100% in-browser</span>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative max-w-xl mx-auto text-center mt-24">
        <div className="w-12 h-px bg-white/[0.06] mx-auto mb-6" />
        <p className="text-xs text-gray-600">
          Built with React, WebLLM & globe.gl
        </p>
      </footer>
    </section>
  )
}
