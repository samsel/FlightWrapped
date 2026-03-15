import { memo } from 'react'
import SplitFlapChar from './SplitFlapChar'

interface SplitFlapRowProps {
  text: string
  rowIndex: number
}

/**
 * One row of 30 split-flap character cells.
 * Each character is staggered by 25ms * column index + row offset.
 */
const SplitFlapRow = memo(function SplitFlapRow({ text, rowIndex }: SplitFlapRowProps) {
  // Pad or truncate to exactly 30 characters
  const padded = text.padEnd(30).slice(0, 30)

  return (
    <div className="flex gap-[2px]">
      {padded.split('').map((char, colIndex) => (
        <SplitFlapChar
          key={colIndex}
          target={char}
          delay={rowIndex * 100 + colIndex * 25}
        />
      ))}
    </div>
  )
})

export default SplitFlapRow
