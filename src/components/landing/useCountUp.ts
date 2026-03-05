import { useState, useEffect } from 'react'

export function useCountUp(end: number, duration = 1500, start = false): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!start) return
    let startTime: number
    let raf: number
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      // Ease-out cubic for smoother deceleration
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.floor(eased * end))
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [end, duration, start])

  return value
}
