import { useState, useEffect, useRef, memo } from 'react'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '

interface SplitFlapCharProps {
  target: string
  delay: number
}

/**
 * Single split-flap character cell.
 * Cycles through random characters at 40ms intervals, then settles on the target.
 */
const SplitFlapChar = memo(function SplitFlapChar({ target, delay }: SplitFlapCharProps) {
  const [displayChar, setDisplayChar] = useState(' ')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Clear any previous timers
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    // Start cycling after the stagger delay
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        setDisplayChar(CHARS[Math.floor(Math.random() * CHARS.length)])
      }, 40)

      // Resolve to target after ~400ms of cycling
      setTimeout(() => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        intervalRef.current = null
        setDisplayChar(target)
      }, 400)
    }, delay)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [target, delay])

  return (
    <span className="split-flap-cell" aria-hidden="true">
      {displayChar}
    </span>
  )
})

export default SplitFlapChar
