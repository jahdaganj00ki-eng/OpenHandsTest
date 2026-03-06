/**
 * FreeAIAgentPro - Dynamic Workflow Scaling Service
 * 
 * Automatically scales agent usage based on task complexity:
 * - Analyzes task complexity
 * - Adjusts resource allocation
 * - Monitors system resources (8GB RAM constraint)
 */

export interface ScalingConfig {
  level: number;
  agents: string[];
  maxIterations: number;
  maxTokens: number;
  mode: 'direct' | 'parallel' | 'concert';
}

export interface SystemMetrics {
  memoryUsedMB: number;
  memoryTotalMB: number;
  cpuUsage: number;
}

// Complexity indicators for different task types
const COMPLEXITY_INDICATORS = {
  simple: [
    'was ist', 'wie spät', 'was ist 2+2', 'datum', 'zeit',
    'wer ist', 'was heißt', 'definition', 'einfache frage',
  ],
  medium: [
    'schreibe code', 'erkläre', 'vergleiche', 'berechne',
    'programmiere', 'recherche', 'suche nach', 'finde',
  ],
  hard: [
    'erstelle eine', 'entwickle', 'implementiere', 'baue',
    'optimiere', 'analysiere', 'entwirf', 'mache eine',
  ],
  complex: [
    'komplettes system', 'vollständige anwendung', 'mehrstufig',
    'komplexe', 'mehrere komponenten', 'architektur',
  ],
};

/**
 * Determine task complexity from user input
 */
function analyzeComplexity(userInput: string): number {
  const input = userInput.toLowerCase();
  let score = 1;
  
  // Check complexity indicators
  for (const indicator of COMPLEXITY_INDICATORS.complex) {
    if (input.includes(indicator)) {
      score = Math.max(score, 4);
    }
  }
  for (const indicator of COMPLEXITY_INDICATORS.hard) {
    if (input.includes(indicator)) {
      score = Math.max(score, 3);
    }
  }
  for (const indicator of COMPLEXITY_INDICATORS.medium) {
    if (input.includes(indicator)) {
      score = Math.max(score, 2);
    }
  }
  
  // Length-based adjustment
  if (input.length > 200) {
    score = Math.min(4, score + 1);
  }
  if (input.length > 500) {
    score = Math.min(4, score + 1);
  }
  
  // Question marks and multiple questions
  const questionCount = (input.match(/\?/g) || []).length;
  if (questionCount > 2) {
    score = Math.min(4, score + 1);
  }
  
  return score;
}

/**
 * Get scaling configuration based on complexity and system resources
 */
export function getScalingConfig(userInput: string, metrics?: SystemMetrics): ScalingConfig {
  const complexity = analyzeComplexity(userInput);
  
  // Base configuration by complexity level
  const configs: Record<number, ScalingConfig> = {
    1: {
      level: 1,
      agents: ['brain'],
      maxIterations: 1,
      maxTokens: 2048,
      mode: 'direct',
    },
    2: {
      level: 2,
      agents: ['brain', 'forge'],
      maxIterations: 1,
      maxTokens: 4096,
      mode: 'parallel',
    },
    3: {
      level: 3,
      agents: ['brain', 'quest', 'forge'],
      maxIterations: 2,
      maxTokens: 6144,
      mode: 'parallel',
    },
    4: {
      level: 4,
      agents: ['brain', 'quest', 'forge', 'spark'],
      maxIterations: 3,
      maxTokens: 8192,
      mode: 'concert',
    },
  };
  
  let config = configs[complexity] || configs[2];
  
  // Adjust for system resources if metrics provided
  if (metrics) {
    config = adjustForResources(config, metrics);
  }
  
  return config;
}

/**
 * Adjust configuration based on available system resources
 */
function adjustForResources(config: ScalingConfig, metrics: SystemMetrics): ScalingConfig {
  const memoryUsedPercent = (metrics.memoryUsedMB / metrics.memoryTotalMB) * 100;
  
  // If memory usage is high, reduce complexity
  if (memoryUsedPercent > 80) {
    return {
      ...config,
      maxIterations: Math.min(config.maxIterations, 1),
      maxTokens: Math.min(config.maxTokens, 2048),
      mode: config.mode === 'concert' ? 'parallel' : config.mode,
    };
  }
  
  // If memory is moderate, make some reductions
  if (memoryUsedPercent > 60) {
    return {
      ...config,
      maxTokens: Math.min(config.maxTokens, 4096),
    };
  }
  
  return config;
}

/**
 * Get current system metrics
 */
export function getSystemMetrics(): SystemMetrics {
  // In a real Electron app, you'd use electron's process.memoryUsage()
  // For now, return estimated values
  if (typeof window !== 'undefined' && (window as any).process?.memory) {
    const mem = (window as any).process.memory();
    return {
      memoryUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      memoryTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      cpuUsage: 0, // Would need native module
    };
  }
  
  // Browser/ fallback
  return {
    memoryUsedMB: 100,
    memoryTotalMB: 8192,
    cpuUsage: 0,
  };
}

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Average: 1 token ≈ 4 characters for German
  return Math.ceil(text.length / 4);
}
