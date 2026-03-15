import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import MboxUpload from '../MboxUpload'

const HeroGlobe = lazy(() => import('./HeroGlobe'))

interface HeroSectionProps {
  onError: (message: string) => void
  onDemoClick: () => void
  onFileUpload: (files: File[]) => void
}

export default function HeroSection({ onError, onDemoClick, onFileUpload }: HeroSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 375, height: 375 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let timeout: ReturnType<typeof setTimeout>
    const obs = new ResizeObserver(([entry]) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        const s = Math.min(entry.contentRect.width, entry.contentRect.height, 900)
        setSize({ width: s, height: s })
      }, 150)
    })
    obs.observe(el)
    return () => { clearTimeout(timeout); obs.disconnect() }
  }, [])

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden noise-overlay"
    >
      {/* Globe background */}
      <div className="absolute inset-0 flex items-center justify-center opacity-15 md:opacity-20 pointer-events-none" aria-hidden="true">
        <Suspense fallback={null}>
          <HeroGlobe width={size.width} height={size.height} />
        </Suspense>
      </div>

      {/* Soft gradient overlays for legibility on cream */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#F5F1EB] via-[#F5F1EB]/80 to-[#F5F1EB] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-24 text-center w-full">
        {/* Privacy badge */}
        <div
          className="hero-stagger inline-flex items-center gap-2.5 px-5 py-2 text-xs font-medium text-[#2D5A27] mb-10 bg-[#E8F0E4] rounded-full border border-[#C8DCC2]"
          style={{ animationDelay: '0.1s' }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#2D5A27] opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2D5A27]" />
          </span>
          100% private. Your emails never leave your device
        </div>

        {/* Brand */}
        <p
          className="hero-stagger text-sm font-semibold tracking-widest uppercase text-[#9A9690] mb-6"
          style={{ animationDelay: '0.2s' }}
        >
          FlightWrapped
        </p>

        {/* Headline */}
        <h1
          className="hero-stagger text-5xl sm:text-6xl md:text-8xl font-bold tracking-tight leading-[0.95] mb-8"
          style={{ animationDelay: '0.25s' }}
        >
          <span className="gradient-text-animated">
            How far have
          </span>
          <br />
          <span className="gradient-text-animated" style={{ animationDelay: '0.5s' }}>
            you flown?
          </span>
        </h1>

        {/* Subheadline */}
        <p
          className="hero-stagger text-lg md:text-xl text-[#6B6960] max-w-2xl mx-auto mb-5 leading-relaxed"
          style={{ animationDelay: '0.45s' }}
        >
          Beautiful travel analytics from your flight confirmation emails
          <span className="text-[#1A1A1A]">. Entirely in your browser.</span>
        </p>

        {/* How-it-works micro steps */}
        <div
          className="hero-stagger flex items-center justify-center gap-3 sm:gap-5 text-sm text-[#6B6960] mb-12 flex-wrap"
          style={{ animationDelay: '0.55s' }}
        >
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#E8F0E4] text-[#2D5A27] text-[10px] font-bold">1</span>
            Export your email
          </span>
          <svg className="w-3 h-3 text-[#9A9690] hidden sm:block" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#E8F0E4] text-[#2D5A27] text-[10px] font-bold">2</span>
            Upload .mbox file
          </span>
          <svg className="w-3 h-3 text-[#9A9690] hidden sm:block" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#E8F0E4] text-[#2D5A27] text-[10px] font-bold">3</span>
            See your stats
          </span>
        </div>

        {/* CTA group */}
        <div
          className="hero-stagger flex flex-col sm:flex-row items-center justify-center gap-4 mb-6"
          style={{ animationDelay: '0.65s' }}
        >
          <div className="relative group">
            <div className="relative">
              <MboxUpload onFileUpload={onFileUpload} onError={onError} />
            </div>
          </div>
          <button
            onClick={onDemoClick}
            className="relative flex items-center gap-2 text-[#2D5A27] hover:text-[#1B3409] transition-all duration-300 text-sm font-medium px-6 py-3.5 border border-[#2D5A27]/30 hover:border-[#2D5A27]/60 bg-transparent hover:bg-[#E8F0E4] rounded-full"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" /></svg>
            Try with sample data
          </button>
        </div>

        {/* Provider support + Takeout link */}
        <p
          className="hero-stagger text-xs text-[#9A9690]"
          style={{ animationDelay: '0.75s' }}
        >
          Works with any email provider · Gmail? Export via <a href="https://takeout.google.com/" target="_blank" rel="noopener noreferrer" className="text-[#2D5A27] hover:text-[#1B3409] underline underline-offset-2">Google Takeout</a>
        </p>
        <div
          className="hero-stagger inline-block px-5 py-2 text-xs font-medium text-[#6B6960] mt-6 bg-white/60 rounded-full border border-[#E5E0D5]"
          style={{ animationDelay: '0.85s' }}
        >
          Built by <a href="https://samselvanathan.com" target="_blank" rel="noopener noreferrer" className="text-[#2D5A27] hover:text-[#1B3409] underline underline-offset-2">samselvanathan.com</a> with the help of <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="text-[#2D5A27] hover:text-[#1B3409] underline underline-offset-2">Claude</a> using{' '}
          <a href="https://react.dev" target="_blank" rel="noopener noreferrer" className="text-[#2D5A27] hover:text-[#1B3409] underline underline-offset-2">React</a>,{' '}
          <a href="https://webllm.mlc.ai" target="_blank" rel="noopener noreferrer" className="text-[#2D5A27] hover:text-[#1B3409] underline underline-offset-2">WebLLM</a> &{' '}
          <a href="https://globe.gl" target="_blank" rel="noopener noreferrer" className="text-[#2D5A27] hover:text-[#1B3409] underline underline-offset-2">globe.gl</a>
        </div>
      </div>

    </section>
  )
}
