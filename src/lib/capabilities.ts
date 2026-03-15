export interface DeviceCapabilities {
  memoryGB: number
  cores: number
  canMultiWorker: boolean
  recommendedWorkers: number
}

/**
 * Detect device capabilities to decide whether multi-worker extraction
 * is feasible. Each additional worker loads its own LLM engine (~2GB),
 * so we only enable this on high-memory, multi-core devices.
 *
 * navigator.deviceMemory is Chrome/Edge only (max bucketed value 8).
 * Safari and Firefox don't support it, so we fall back to cores alone —
 * any device with 8+ logical cores (all Apple Silicon Macs) has >=8GB RAM.
 */
export function detectCapabilities(): DeviceCapabilities {
  const deviceMemory = (navigator as { deviceMemory?: number }).deviceMemory
  const memoryGB = deviceMemory ?? 4
  const cores = navigator.hardwareConcurrency ?? 4
  const canMultiWorker = deviceMemory !== undefined
    ? memoryGB >= 8 && cores >= 8   // Chrome/Edge: check both
    : cores >= 8                     // Safari/Firefox: cores alone
  return { memoryGB, cores, canMultiWorker, recommendedWorkers: canMultiWorker ? 2 : 1 }
}
