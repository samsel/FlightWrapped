import { useRef, useEffect, useMemo } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'

const DEMO_ARCS = [
  { startLat: 40.64, startLng: -73.78, endLat: 51.47, endLng: -0.46 },   // JFK → LHR
  { startLat: 33.94, startLng: -118.41, endLat: 35.76, endLng: 140.39 },  // LAX → NRT
  { startLat: 1.35, startLng: 103.99, endLat: 25.25, endLng: 55.36 },     // SIN → DXB
  { startLat: -33.95, startLng: 151.18, endLat: 37.62, endLng: -122.38 }, // SYD → SFO
  { startLat: 48.86, startLng: 2.35, endLat: -22.91, endLng: -43.17 },    // CDG → GIG
  { startLat: 25.79, startLng: -80.29, endLat: 19.44, endLng: -99.07 },   // MIA → MEX
]

export default function HeroGlobe({ width, height }: { width: number; height: number }) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)

  // Clean up WebGL resources on unmount to prevent GPU memory leaks
  useEffect(() => {
    return () => {
      const globe = globeRef.current
      if (globe) {
        const renderer = globe.renderer()
        renderer.dispose()
        renderer.forceContextLoss()
      }
    }
  }, [])

  const configureControls = () => {
    const controls = globeRef.current?.controls()
    if (controls) {
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.3
      controls.enableZoom = false
      controls.enablePan = false
      controls.enableRotate = false
    }
  }

  const arcsData = useMemo(() => DEMO_ARCS, [])

  return (
    <Globe
      ref={globeRef}
      onGlobeReady={configureControls}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      globeImageUrl={`${import.meta.env.BASE_URL}textures/earth-blue-marble.jpg`}
      showAtmosphere={true}
      atmosphereColor="#3b82f6"
      atmosphereAltitude={0.15}
      animateIn={false}
      arcsData={arcsData}
      arcStartLat="startLat"
      arcStartLng="startLng"
      arcEndLat="endLat"
      arcEndLng="endLng"
      arcColor={() => ['rgba(59,130,246,0.6)', 'rgba(96,165,250,0.6)']}
      arcDashLength={0.6}
      arcDashGap={0.3}
      arcDashAnimateTime={3000}
      arcStroke={0.3}
    />
  )
}
