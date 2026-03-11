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
      <div className="absolute inset-0 flex items-center justify-center opacity-25 md:opacity-35 pointer-events-none" aria-hidden="true">
        <Suspense fallback={null}>
          <HeroGlobe width={size.width} height={size.height} />
        </Suspense>
      </div>

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-950/70 to-gray-950 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.08)_0%,_transparent_60%)] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-24 text-center w-full">
        {/* Privacy badge */}
        <div
          className="hero-stagger inline-flex items-center gap-2.5 px-5 py-2 text-xs font-medium text-blue-300 mb-10 glass-card"
          style={{ animationDelay: '0.1s' }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
          </span>
          100% private. Your emails never leave your device
        </div>

        {/* Brand */}
        <p
          className="hero-stagger text-sm font-semibold tracking-widest uppercase text-gray-400 mb-6"
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
          className="hero-stagger text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-5 leading-relaxed"
          style={{ animationDelay: '0.45s' }}
        >
          Beautiful travel analytics from your flight confirmation emails
          <span className="text-gray-300">. Entirely in your browser.</span>
        </p>

        {/* How-it-works micro steps */}
        <div
          className="hero-stagger flex items-center justify-center gap-3 sm:gap-5 text-sm text-gray-400 mb-12 flex-wrap"
          style={{ animationDelay: '0.55s' }}
        >
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-500/15 text-blue-400 text-[10px] font-bold">1</span>
            Export your email
          </span>
          <svg className="w-3 h-3 text-gray-600 hidden sm:block" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 bg-purple-500/15 text-purple-400 text-[10px] font-bold">2</span>
            Upload .mbox file
          </span>
          <svg className="w-3 h-3 text-gray-600 hidden sm:block" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">3</span>
            See your stats
          </span>
        </div>

        {/* CTA group */}
        <div
          className="hero-stagger flex flex-col sm:flex-row items-center justify-center gap-4 mb-6"
          style={{ animationDelay: '0.65s' }}
        >
          <div className="relative group">
            {/* Glow behind button */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/30 to-purple-500/30 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative">
              <MboxUpload onFileUpload={onFileUpload} onError={onError} />
            </div>
          </div>
          <button
            onClick={onDemoClick}
            className="relative flex items-center gap-2 text-white/90 hover:text-white transition-all duration-300 text-sm font-medium px-6 py-3.5 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" /></svg>
            Try with sample data
          </button>
        </div>

        {/* Provider support + Takeout link */}
        <p
          className="hero-stagger text-xs text-gray-500"
          style={{ animationDelay: '0.75s' }}
        >
          Works with any email provider · Gmail? Export via <a href="https://takeout.google.com/" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white underline underline-offset-2">Google Takeout</a>
        </p>
        <div
          className="hero-stagger inline-block px-5 py-2 text-xs font-medium text-gray-400 mt-6 glass-card"
          style={{ animationDelay: '0.85s' }}
        >
          Built by <a href="https://samselvanathan.com" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white underline underline-offset-2">samselvanathan.com</a> with the help of <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white underline underline-offset-2">Claude</a> using{' '}
          <a href="https://react.dev" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white underline underline-offset-2">React</a>,{' '}
          <a href="https://webllm.mlc.ai" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white underline underline-offset-2">WebLLM</a> &{' '}
          <a href="https://globe.gl" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white underline underline-offset-2">globe.gl</a>
        </div>
      </div>

    </section>
  )
}
