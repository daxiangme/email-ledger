import { useLayoutEffect, useRef, useState } from "react"
import { ChevronRightIcon } from "lucide-react"
import { animate, motion, useMotionValue, useMotionValueEvent } from "motion/react"

import { Button } from "@/components/ui/button"

const SNAP_BACK = { type: "spring" as const, stiffness: 500, damping: 30, mass: 0.6 }
const GLIDE = { type: "spring" as const, stiffness: 700, damping: 50, mass: 0.5 }
const THRESHOLD = 0.85

export function SlideConfirm({
  disabled,
  onConfirm,
  onCancel,
}: {
  disabled?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const [max, setMax] = useState(0)
  const [armed, setArmed] = useState(false)
  const [percent, setPercent] = useState(0)
  const dragging = useRef(false)
  const confirmed = useRef(false)

  useLayoutEffect(() => {
    const measure = () => {
      const track = trackRef.current
      if (!track) return
      setMax(Math.max(track.clientWidth - 44, 0))
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (trackRef.current) observer.observe(trackRef.current)
    return () => observer.disconnect()
  }, [])

  useMotionValueEvent(x, "change", (value) => {
    setArmed(max > 0 && value >= max * THRESHOLD)
    setPercent(max === 0 ? 0 : Math.round((value / max) * 100))
  })

  function finish(commit: boolean) {
    dragging.current = false
    if (commit && !confirmed.current) {
      confirmed.current = true
      animate(x, max, GLIDE).then(onConfirm)
      return
    }
    animate(x, 0, SNAP_BACK)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        删除后这台电脑和同步过去的另一台都会去掉它。滑过右侧才删除。
      </p>
      <div
        ref={trackRef}
        className="relative h-11 overflow-hidden rounded-lg bg-muted"
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          {armed ? "松开即可删除" : "滑动以删除"}
        </div>
        <motion.button
          type="button"
          className="absolute top-1 left-1 flex size-9 items-center justify-center rounded-md bg-destructive text-sm text-white"
          style={{ x }}
          aria-label="滑动以删除"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          role="slider"
          disabled={disabled}
          onPointerDown={(event) => {
            if (disabled) return
            dragging.current = true
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (!dragging.current || !trackRef.current) return
            const rect = trackRef.current.getBoundingClientRect()
            const next = Math.min(Math.max(event.clientX - rect.left - 22, 0), max)
            x.set(next)
          }}
          onPointerUp={() => finish(x.get() >= max * THRESHOLD)}
          onPointerCancel={() => finish(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation()
              onCancel()
              return
            }
            if (event.key === "ArrowRight") {
              event.preventDefault()
              const next = Math.min(x.get() + max * 0.2, max)
              x.set(next)
              if (next >= max * THRESHOLD) finish(true)
            }
            if (event.key === "ArrowLeft") {
              event.preventDefault()
              x.set(Math.max(x.get() - max * 0.2, 0))
            }
          }}
        >
          <ChevronRightIcon />
        </motion.button>
      </div>
      <Button type="button" variant="ghost" className="self-start" onClick={onCancel}>
        返回
      </Button>
    </div>
  )
}
