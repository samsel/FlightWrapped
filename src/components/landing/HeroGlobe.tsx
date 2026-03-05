import { useRef, useEffect } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'

export default function HeroGlobe({ width, height }: { width: number; height: number }) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)

  useEffect(() => {
    if (globeRef.current) {
      const controls = globeRef.current.controls()
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.3
      controls.enableZoom = false
      controls.enablePan = false
      controls.enableRotate = false
    }
  }, [])

  return (
    <Globe
      ref={globeRef}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      globeImageUrl="https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg"
      showAtmosphere={true}
      atmosphereColor="#3b82f6"
      atmosphereAltitude={0.15}
      animateIn={false}
    />
  )
}
