import { useEffect, useState } from 'react'

/**
 * Two-step confirmation for irreversible actions: the first click arms the
 * button, the second (within `ms`) runs it.
 */
export function useConfirm(run: () => void, ms = 3000) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const id = setTimeout(() => setArmed(false), ms)
    return () => clearTimeout(id)
  }, [armed, ms])

  return {
    armed,
    onClick: () => {
      if (armed) {
        setArmed(false)
        run()
      } else {
        setArmed(true)
      }
    },
  }
}
