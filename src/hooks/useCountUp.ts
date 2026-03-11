import { useState, useEffect } from 'react'

export function useCountUp(end: number, duration = 1500, start = false): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!start) return
    if (end === 0) {
      setValue(0)
      return
    }
    let startTime: number | undefined
    let raf: number
    const step = (timestamp: number) => {
      if (startTime === undefined) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      // Ease-out cubic for smoother deceleration
      const eased = 1 - Math.pow(1 - progress, 3)
      // Use Math.round to avoid stuck-at-(end-1) due to floating-point;
      // clamp to end to guarantee the final frame lands exactly on target.
      setValue(progress >= 1 ? end : Math.round(eased * end))
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [end, duration, start])

  return value
}
