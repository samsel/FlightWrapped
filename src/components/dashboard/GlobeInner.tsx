import Globe, { type GlobeMethods } from 'react-globe.gl'
import { useRef, useEffect } from 'react'

interface ArcDatum {
  startLat: number
  startLng: number
  endLat: number
  endLng: number
}

interface PointDatum {
  lat: number
  lng: number
  label: string
}

interface Props {
  width: number
  height: number
  arcsData: ArcDatum[]
  pointsData: PointDatum[]
}

export default function GlobeInner({ width, height, arcsData, pointsData }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)

  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    const controls = globe.controls()
    if (controls) {
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.6
    }
    // Auto-fly to the center of all points on mount
    if (pointsData.length > 0) {
      const avgLat = pointsData.reduce((s, p) => s + p.lat, 0) / pointsData.length
      const avgLng = pointsData.reduce((s, p) => s + p.lng, 0) / pointsData.length
      setTimeout(() => {
        globe.pointOfView({ lat: avgLat, lng: avgLng, altitude: 1.8 }, 1500)
      }, 500)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  return (
    <Globe
      ref={globeRef}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      globeImageUrl={`${import.meta.env.BASE_URL}textures/earth-night.jpg`}
      atmosphereColor="#3b82f6"
      atmosphereAltitude={0.2}
      arcsData={arcsData}
      arcStartLat="startLat"
      arcStartLng="startLng"
      arcEndLat="endLat"
      arcEndLng="endLng"
      arcColor={() => ['#3b82f6', '#60a5fa']}
      arcDashLength={0.6}
      arcDashGap={0.3}
      arcDashAnimateTime={2000}
      arcStroke={0.5}
      pointsData={pointsData}
      pointLat="lat"
      pointLng="lng"
      pointColor={() => '#f59e0b'}
      pointAltitude={0.01}
      pointRadius={0.4}
      pointsMerge={true}
      pointLabel="label"
    />
  )
}
