/** Size motion policy for a layout surface registered by type. */
export interface SurfaceLayoutPolicy {
  resize: {
    /** Whether the runtime should animate height changes. */
    enabled: boolean
    /** CSS properties to animate. Currently only 'height'. */
    properties: string[]
    /** Duration in ms. */
    duration: number
    /** CSS easing function string. */
    easing: string
  }
}
