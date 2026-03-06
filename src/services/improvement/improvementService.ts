/**
 * FreeAIAgentPro - Self-Improvement System
 * 
 * Enables the agent to learn and improve from interactions:
 * - Task evaluation after each request
 * - Prompt evolution based on experience
 * - Skill system for learning new capabilities
 * - Versioning of all changes
 */

export interface TaskEvaluation {
  taskId: string;
  timestamp: number;
  userInput: string;
  success: boolean;
  feedback?: 'positive' | 'negative' | 'neutral';
  issues?: string[];
  improvements?: string[];
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  prompt: string;
  examples: string[];
  createdAt: number;
  usageCount: number;
}

export interface PromptVersion {
  version: number;
  prompt: string;
  changedAt: number;
  reason: string;
}

/**
 * Self-Improvement Service
 */
class SelfImprovementService {
  private taskHistory: TaskEvaluation[] = [];
  private skills: Map<string, Skill> = new Map();
  private promptVersions: Map<string, PromptVersion[]> = new Map();
  private maxHistory: number = 500;
  private versionCounter: number = 1;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Evaluate a completed task
   */
  evaluateTask(
    taskId: string,
    userInput: string,
    success: boolean,
    feedback?: 'positive' | 'negative' | 'neutral',
    issues?: string[],
    improvements?: string[]
  ): void {
    const evaluation: TaskEvaluation = {
      taskId,
      timestamp: Date.now(),
      userInput,
      success,
      feedback,
      issues,
      improvements,
    };
    
    this.taskHistory.push(evaluation);
    this.pruneHistory();
    this.saveToStorage();
    
    // Trigger improvement analysis if negative feedback
    if (feedback === 'negative' && improvements?.length) {
      this.analyzeAndImprove(userInput, improvements);
    }
  }

  /**
   * Analyze task and potentially improve system
   */
  private async analyzeAndImprove(userInput: string, improvements: string[]): Promise<void> {
    // In a full implementation, this would use the LLM to:
    // 1. Analyze what went wrong
    // 2. Suggest prompt modifications
    // 3. Identify new skills to learn
    
    console.log('Self-improvement triggered:', { userInput, improvements });
  }

  /**
   * Add a new skill
   */
  addSkill(name: string, description: string, prompt: string, examples: string[] = []): string {
    const id = `skill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const skill: Skill = {
      id,
      name,
      description,
      prompt,
      examples,
      createdAt: Date.now(),
      usageCount: 0,
    };
    
    this.skills.set(id, skill);
    this.saveToStorage();
    
    return id;
  }

  /**
   * Get skill by name
   */
  getSkill(name: string): Skill | undefined {
    for (const skill of this.skills.values()) {
      if (skill.name.toLowerCase() === name.toLowerCase()) {
        skill.usageCount++;
        this.saveToStorage();
        return skill;
      }
    }
    return undefined;
  }

  /**
   * Get all skills
   */
  getAllSkills(): Skill[] {
    return Array.from(this.skills.values())
      .sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Update prompt version
   */
  updatePromptVersion(promptId: string, newPrompt: string, reason: string): void {
    const versions = this.promptVersions.get(promptId) || [];
    
    const newVersion: PromptVersion = {
      version: this.versionCounter++,
      prompt: newPrompt,
      changedAt: Date.now(),
      reason,
    };
    
    versions.push(newVersion);
    
    // Keep only last 10 versions
    if (versions.length > 10) {
      versions.shift();
    }
    
    this.promptVersions.set(promptId, versions);
    this.saveToStorage();
  }

  /**
   * Get prompt version history
   */
  getPromptVersions(promptId: string): PromptVersion[] {
    return this.promptVersions.get(promptId) || [];
  }

  /**
   * Get recent evaluations
   */
  getRecentEvaluations(limit: number = 10): TaskEvaluation[] {
    return this.taskHistory.slice(-limit);
  }

  /**
   * Get success rate
   */
  getSuccessRate(): number {
    if (this.taskHistory.length === 0) return 100;
    
    const successful = this.taskHistory.filter(t => t.success).length;
    return (successful / this.taskHistory.length) * 100;
  }

  /**
   * Get common issues
   */
  getCommonIssues(): string[] {
    const issues: Map<string, number> = new Map();
    
    for (const task of this.taskHistory) {
      if (task.issues) {
        for (const issue of task.issues) {
          issues.set(issue, (issues.get(issue) || 0) + 1);
        }
      }
    }
    
    return Array.from(issues.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([issue]) => issue);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalTasks: number;
    successRate: number;
    totalSkills: number;
    promptVersions: number;
    commonIssues: string[];
  } {
    return {
      totalTasks: this.taskHistory.length,
      successRate: this.getSuccessRate(),
      totalSkills: this.skills.size,
      promptVersions: this.versionCounter - 1,
      commonIssues: this.getCommonIssues(),
    };
  }

  /**
   * Clear all data
   */
  clearAll(): void {
    this.taskHistory = [];
    this.skills.clear();
    this.promptVersions.clear();
    this.saveToStorage();
  }

  /**
   * Prune old history
   */
  private pruneHistory(): void {
    if (this.taskHistory.length > this.maxHistory) {
      this.taskHistory = this.taskHistory.slice(-this.maxHistory);
    }
  }

  /**
   * Save to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = {
        taskHistory: this.taskHistory,
        skills: Array.from(this.skills.entries()),
        promptVersions: Array.from(this.promptVersions.entries()),
        versionCounter: this.versionCounter,
      };
      localStorage.setItem('freeaiagentpro_improvement', JSON.stringify(data));
    } catch (e) {
      console.warn('Could not save improvement data:', e);
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem('freeaiagentpro_improvement');
      if (data) {
        const parsed = JSON.parse(data);
        this.taskHistory = parsed.taskHistory || [];
        this.skills = new Map(parsed.skills || []);
        this.promptVersions = new Map(parsed.promptVersions || []);
        this.versionCounter = parsed.versionCounter || 1;
      }
    } catch (e) {
      console.warn('Could not load improvement data:', e);
    }
  }
}

// Export singleton instance
export const improvementService = new SelfImprovementService();
