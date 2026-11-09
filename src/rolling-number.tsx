import { useEffect, useRef, useState } from "react"
import { animate, useReducedMotion } from "motion/react"

const EASE_OUT = [0.16, 1, 0.3, 1] as const

export function RollingNumber({ value }: { value: number }) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(value)
  const previous = useRef(value)
  const seen = useRef(false)

  useEffect(() => {
    if (!seen.current) {
      seen.current = true
      previous.current = value
      setShown(value)
      return
    }
    const from = previous.current
    previous.current = value
    if (reduced || from === value) {
      setShown(value)
      return
    }
    const controls = animate(from, value, {
      duration: 0.5,
      ease: EASE_OUT,
      onUpdate: (latest) => setShown(Math.round(latest)),
    })
    return () => controls.stop()
  }, [reduced, value])

  return <span className="tabular-nums">{shown}</span>
}
