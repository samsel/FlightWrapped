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
      {/* Dramatic background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-blue-500/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[250px] bg-purple-500/5 rounded-full blur-[80px] pointer-events-none" />

      <div className={`relative max-w-2xl mx-auto text-center transition-all duration-1000 ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      }`}>
        <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
          Ready to see your flight map?
        </h2>
        <p className="text-gray-400 text-lg mb-10">
          Takes about 30 seconds. Your emails never leave your browser.
        </p>

        <div className="flex flex-col items-center gap-5">
          <div className="relative group">
            <div className="absolute -inset-1.5 bg-gradient-to-r from-blue-500/25 to-purple-500/25 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative">
              <GmailConnect onError={onError} />
            </div>
          </div>
          <button
            onClick={onDemoClick}
            className="text-gray-400 hover:text-white transition-all duration-300 text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-white/5"
          >
            Or try with sample data &rarr;
          </button>
        </div>

        <div className="flex items-center justify-center gap-3 text-xs text-gray-500 mt-6 flex-wrap">
          <span>Read-only access</span>
          <span className="w-1 h-1 rounded-full bg-gray-700" />
          <span>Nothing stored</span>
          <span className="w-1 h-1 rounded-full bg-gray-700" />
          <span>100% in-browser</span>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative max-w-xl mx-auto text-center mt-24">
        <div className="w-12 h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent mx-auto mb-6" />
        <p className="text-xs text-gray-600">
          Built with React, WebLLM & globe.gl
        </p>
      </footer>
    </section>
  )
}
