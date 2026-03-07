import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import GmailConnect from '../GmailConnect'
import { ChevronDownIcon } from './icons'

const HeroGlobe = lazy(() => import('./HeroGlobe'))

interface HeroSectionProps {
  onError: (message: string) => void
  onDemoClick: () => void
}

export default function HeroSection({ onError, onDemoClick }: HeroSectionProps) {
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

  const scrollToPreview = () => {
    document.getElementById('preview')?.scrollIntoView({ behavior: 'smooth' })
  }

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

      {/* Overlay */}
      <div className="absolute inset-0 bg-gray-950/80 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-24 text-center w-full">
        {/* Privacy badge */}
        <div
          className="hero-stagger inline-flex items-center gap-2.5 px-5 py-2 text-xs font-medium text-blue-300 mb-10 glass-card"
          style={{ animationDelay: '0.1s' }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full bg-green-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 bg-green-400" />
          </span>
          100% private — runs entirely in your browser
        </div>

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
          className="hero-stagger text-lg md:text-xl text-gray-400 max-w-xl mx-auto mb-12 leading-relaxed"
          style={{ animationDelay: '0.45s' }}
        >
          Turn your inbox into a stunning map of everywhere you've been.
          <span className="text-gray-300"> One click. Completely private.</span>
        </p>

        {/* CTA group */}
        <div
          className="hero-stagger flex flex-col sm:flex-row items-center justify-center gap-5 mb-6"
          style={{ animationDelay: '0.6s' }}
        >
          <GmailConnect onError={onError} />
          <button
            onClick={onDemoClick}
            className="relative text-gray-400 hover:text-white transition-all duration-300 text-sm font-medium px-5 py-3 hover:bg-white/5"
          >
            Try with sample data &rarr;
          </button>
        </div>

        {/* Trust micro-copy */}
        <div
          className="hero-stagger flex items-center justify-center gap-3 text-xs text-gray-400 flex-wrap"
          style={{ animationDelay: '0.75s' }}
        >
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-green-500/70" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
            Read-only access
          </span>
          <span className="w-1 h-1 bg-gray-700" />
          <span>Nothing stored</span>
          <span className="w-1 h-1 bg-gray-700" />
          <span>Nothing sent anywhere</span>
        </div>
      </div>

      {/* Scroll indicator */}
      <button
        onClick={scrollToPreview}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 text-gray-600 hover:text-gray-400 transition-colors animate-bounce"
        aria-label="Scroll down"
      >
        <ChevronDownIcon className="w-5 h-5" />
      </button>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gray-950 pointer-events-none" />
    </section>
  )
}
