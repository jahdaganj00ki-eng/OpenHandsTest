/**
 * FreeAIAgentPro - Agent Orchestrator
 * 
 * Coordinates the 4-agent multi-agent workflow:
 * - Brain (Commander): Task decomposition, coordination
 * - Quest (Researcher): Real-time search, fact-checking
 * - Forge (Engineer): Step-by-step reasoning, calculations, code
 * - Spark (Creative): Divergent thinking, blind-spot detection, UX
 */

import { apiService, AgentResponse } from '../api/apiService';
import { SCALING_SYSTEM_PROMPT } from '../../prompts/agentPrompts';

export interface WorkflowResult {
  finalResponse: string;
  agentResponses: AgentResponse[];
  complexity: number;
  processingTime: number;
}

export interface ScalingConfig {
  level: number;
  agents: string[];
  maxIterations: number;
  tokens: number;
  mode: 'direct' | 'parallel' | 'concert';
}

/**
 * Analyze task complexity and determine required agents
 */
async function analyzeComplexity(userInput: string): Promise<ScalingConfig> {
  const prompt = `${SCALING_SYSTEM_PROMPT}\n\nAnfrage: ${userInput}`;
  
  try {
    const response = await apiService.generate(
      prompt,
      'Du bist ein System zur Analyse von Aufgabenkomplexität. Antworte mit einer Zahl von 1-4 und einer kurzen Begründung.'
    );
    
    // Parse the response
    const levelMatch = response.match(/[1-4]/);
    const level = levelMatch ? parseInt(levelMatch[0]) : 2;
    
    return determineScalingConfig(level, response);
  } catch {
    // Default to level 2 if analysis fails
    return determineScalingConfig(2, 'Standard fallback');
  }
}

/**
 * Determine scaling configuration based on complexity level
 */
function determineScalingConfig(level: number, analysis: string): ScalingConfig {
  const configs: Record<number, ScalingConfig> = {
    1: {
      level: 1,
      agents: ['brain'],
      maxIterations: 1,
      tokens: 2048,
      mode: 'direct',
    },
    2: {
      level: 2,
      agents: ['brain', 'forge'],
      maxIterations: 1,
      tokens: 4096,
      mode: 'parallel',
    },
    3: {
      level: 3,
      agents: ['brain', 'quest', 'forge'],
      maxIterations: 2,
      tokens: 6144,
      mode: 'parallel',
    },
    4: {
      level: 4,
      agents: ['brain', 'quest', 'forge', 'spark'],
      maxIterations: 3,
      tokens: 8192,
      mode: 'concert',
    },
  };
  
  return configs[level] || configs[2];
}

/**
 * Parse required agents from Brain's response
 */
function parseRequiredAgents(brainResponse: string): string[] {
  const agents: string[] = ['brain'];
  const response = brainResponse.toLowerCase();
  
  if (response.includes('recherche') || response.includes('such') || response.includes('information')) {
    agents.push('quest');
  }
  if (response.includes('code') || response.includes('berechnung') || response.includes('technisch')) {
    agents.push('forge');
  }
  if (response.includes('kreativ') || response.includes('ux') || response.includes('design') || response.includes('idee')) {
    agents.push('spark');
  }
  
  return agents;
}

/**
 * Agent Orchestrator Class
 */
class AgentOrchestrator {
  private activeAgents: Set<string> = new Set();
  private conversationHistory: Array<{ role: string; content: string }> = [];

  /**
   * Process a user request through the multi-agent workflow
   */
  async processRequest(userInput: string): Promise<WorkflowResult> {
    const startTime = Date.now();
    const agentResponses: AgentResponse[] = [];
    
    // Add user input to history
    this.conversationHistory.push({ role: 'user', content: userInput });
    
    // Step 1: Analyze complexity and determine scaling
    const scalingConfig = await analyzeComplexity(userInput);
    
    // Step 2: Brain (Commander) analyzes and plans
    const brainResponse = await apiService.callAgent('brain', userInput, {
      context: 'initial',
      history: this.conversationHistory.slice(-5),
    });
    agentResponses.push(brainResponse);
    
    // Step 3: Based on Brain's plan, call additional agents
    let requiredAgents: string[];
    
    if (scalingConfig.level === 1) {
      // Simple request - Brain handles it alone
      requiredAgents = ['brain'];
    } else {
      // Parse required agents from Brain's response
      requiredAgents = parseRequiredAgents(brainResponse.content);
    }
    
    // Filter to only include agents in the scaling config
    const agentsToCall = requiredAgents.filter(a => 
      scalingConfig.agents.includes(a) && a !== 'brain'
    );
    
    // Call agents based on mode
    if (scalingConfig.mode === 'parallel' || scalingConfig.mode === 'concert') {
      // Parallel execution for independent agents
      const parallelResults = await Promise.all(
        agentsToCall.map(agentId => 
          apiService.callAgent(agentId, userInput, {
            brainPlan: brainResponse.content,
            history: this.conversationHistory.slice(-5),
          })
        )
      );
      agentResponses.push(...parallelResults);
    } else {
      // Sequential execution
      for (const agentId of agentsToCall) {
        const result = await apiService.callAgent(agentId, userInput, {
          brainPlan: brainResponse.content,
          history: this.conversationHistory.slice(-5),
        });
        agentResponses.push(result);
      }
    }
    
    // Step 4: Brain synthesizes final response
    const finalResponse = await apiService.callAgent('brain', userInput, {
      context: 'synthesis',
      agentResults: agentResponses.map(r => ({
        agent: r.agentId,
        content: r.content,
      })),
    });
    
    // Add response to history
    this.conversationHistory.push({ role: 'assistant', content: finalResponse.content });
    
    // Keep history limited
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }
    
    return {
      finalResponse: finalResponse.content,
      agentResponses,
      complexity: scalingConfig.level,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Get currently active agents
   */
  getActiveAgents(): string[] {
    return Array.from(this.activeAgents);
  }

  /**
   * Get conversation history
   */
  getHistory(): Array<{ role: string; content: string }> {
    return this.conversationHistory;
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }
}

// Export singleton instance
export const agentOrchestrator = new AgentOrchestrator();
