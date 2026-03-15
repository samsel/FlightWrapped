import { useState, useEffect, useCallback, useRef } from 'react'
import SplitFlapRow from './SplitFlapRow'
import { AVIATION_FACTS } from '@/data/aviation-facts'

const COLS = 30
const ROWS = 4
const ROTATION_INTERVAL = 6000

/** Fisher-Yates shuffle (in-place) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Word-wrap text into rows of `cols` characters, breaking on word boundaries */
function wrapText(text: string, cols: number, rows: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    if (current.length === 0) {
      current = word
    } else if (current.length + 1 + word.length <= cols) {
      current += ' ' + word
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current.length > 0) lines.push(current)

  // Pad to exactly `rows` lines
  while (lines.length < rows) lines.push('')
  return lines.slice(0, rows)
}

/**
 * Self-contained split-flap departure board.
 * Rotates through shuffled aviation facts every 6 seconds.
 */
export default function SplitFlapBoard() {
  const orderRef = useRef<number[]>([])
  const indexRef = useRef(0)
  const [lines, setLines] = useState<string[]>(() => {
    const order = shuffle([...Array(AVIATION_FACTS.length).keys()])
    orderRef.current = order
    indexRef.current = 0
    return wrapText(AVIATION_FACTS[order[0]], COLS, ROWS)
  })
  // Increment a key to force SplitFlapRow remount on each rotation
  const [cycle, setCycle] = useState(0)

  const advance = useCallback(() => {
    indexRef.current++
    if (indexRef.current >= orderRef.current.length) {
      // Reshuffle when all facts have been shown
      orderRef.current = shuffle([...Array(AVIATION_FACTS.length).keys()])
      indexRef.current = 0
    }
    const factIndex = orderRef.current[indexRef.current]
    setLines(wrapText(AVIATION_FACTS[factIndex], COLS, ROWS))
    setCycle(c => c + 1)
  }, [])

  useEffect(() => {
    const id = setInterval(advance, ROTATION_INTERVAL)
    return () => clearInterval(id)
  }, [advance])

  return (
    <div className="split-flap-board hidden lg:block" role="complementary" aria-label="Aviation facts">
      <div className="text-xs tracking-[0.2em] text-[#F0C040]/60 mb-3 font-mono uppercase">
        Did You Know
      </div>
      <div className="flex flex-col gap-[3px]">
        {lines.map((line, i) => (
          <SplitFlapRow key={`${cycle}-${i}`} text={line} rowIndex={i} />
        ))}
      </div>
    </div>
  )
}
