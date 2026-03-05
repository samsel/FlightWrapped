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
    if (globeRef.current) {
      const controls = globeRef.current.controls()
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.6
    }
  }, [])

  return (
    <Globe
      ref={globeRef}
      width={width}
      height={height}
      backgroundColor="rgba(0,0,0,0)"
      globeImageUrl="https://cdn.jsdelivr.net/npm/three-globe@2.31.3/example/img/earth-night.jpg"
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
