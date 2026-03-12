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
 * navigator.deviceMemory reports a bucketed value (max 8 on Chrome).
 * We require >=8 (meaning the device has at least 8GB physical RAM)
 * and >=8 logical cores.
 */
export function detectCapabilities(): DeviceCapabilities {
  const memoryGB = (navigator as { deviceMemory?: number }).deviceMemory ?? 4
  const cores = navigator.hardwareConcurrency ?? 4
  const canMultiWorker = memoryGB >= 8 && cores >= 8
  return { memoryGB, cores, canMultiWorker, recommendedWorkers: canMultiWorker ? 2 : 1 }
}
