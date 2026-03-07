import { useRef, useEffect } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'

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
    />
  )
}
