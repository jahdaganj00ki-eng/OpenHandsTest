/**
 * FreeAIAgentPro - Memory System
 * 
 * Stores important facts and learns from interactions:
 * - Auto-memory: Important facts are automatically saved
 * - Manual memory: User can explicitly save information
 * - Retrieval: Fast access to relevant memories
 */

export interface Memory {
  id: string;
  content: string;
  category: 'fact' | 'preference' | 'skill' | 'context';
  importance: number;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  tags: string[];
}

export interface MemoryQuery {
  query: string;
  limit?: number;
  category?: Memory['category'];
}

/**
 * Simple Memory Service using in-memory storage
 * Optimized for 8GB RAM constraint
 */
class MemoryService {
  private memories: Map<string, Memory> = new Map();
  private maxMemories: number = 1000;
  private autoSaveKeywords = [
    'merke', 'erinnere', 'speichere', 'merken', 'wichtig',
    'preferiere', 'mag nicht', 'immer', 'nie', 'routine',
  ];

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Add a new memory
   */
  addMemory(content: string, category: Memory['category'] = 'context', importance: number = 5): string {
    const id = this.generateId();
    const tags = this.extractTags(content);
    
    const memory: Memory = {
      id,
      content,
      category,
      importance,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 0,
      tags,
    };
    
    this.memories.set(id, memory);
    this.pruneIfNeeded();
    this.saveToStorage();
    
    return id;
  }

  /**
   * Auto-save important facts from conversation
   */
  autoSave(content: string): string | null {
    const lowerContent = content.toLowerCase();
    
    // Check if content contains auto-save keywords
    const shouldSave = this.autoSaveKeywords.some(keyword => 
      lowerContent.includes(keyword)
    );
    
    if (shouldSave) {
      // Determine category based on content
      let category: Memory['category'] = 'context';
      if (lowerContent.includes('code') || lowerContent.includes('programm')) {
        category = 'skill';
      } else if (lowerContent.includes('mag') || lowerContent.includes('preferiere')) {
        category = 'preference';
      }
      
      return this.addMemory(content, category, 7);
    }
    
    return null;
  }

  /**
   * Search memories by query
   */
  search(query: MemoryQuery): Memory[] {
    const results: Array<{ memory: Memory; score: number }> = [];
    const queryLower = query.query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);
    
    for (const memory of this.memories.values()) {
      // Filter by category if specified
      if (query.category && memory.category !== query.category) {
        continue;
      }
      
      // Calculate relevance score
      let score = 0;
      const contentLower = memory.content.toLowerCase();
      
      // Exact match bonus
      if (contentLower.includes(queryLower)) {
        score += 10;
      }
      
      // Word match
      for (const word of queryWords) {
        if (contentLower.includes(word)) {
          score += 2;
        }
      }
      
      // Tag match
      for (const tag of memory.tags) {
        if (queryLower.includes(tag.toLowerCase())) {
          score += 3;
        }
      }
      
      // Importance bonus
      score += memory.importance;
      
      // Recency bonus
      const age = Date.now() - memory.lastAccessed;
      if (age < 86400000) { // Less than 24 hours
        score += 2;
      }
      
      if (score > 0) {
        results.push({ memory, score });
      }
    }
    
    // Sort by score and return top results
    results.sort((a, b) => b.score - a.score);
    
    const limit = query.limit || 5;
    return results.slice(0, limit).map(r => {
      // Update access stats
      const mem = r.memory;
      mem.lastAccessed = Date.now();
      mem.accessCount++;
      return mem;
    });
  }

  /**
   * Get context from memories for RAG
   */
  getContextForQuery(query: string, maxTokens: number = 500): string {
    const memories = this.search({ query, limit: 10 });
    
    let context = '';
    for (const memory of memories) {
      if (context.length + memory.content.length > maxTokens) {
        break;
      }
      context += `[${memory.category}] ${memory.content}\n\n`;
    }
    
    return context;
  }

  /**
   * Get all memories
   */
  getAllMemories(): Memory[] {
    return Array.from(this.memories.values())
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get memories by category
   */
  getByCategory(category: Memory['category']): Memory[] {
    return Array.from(this.memories.values())
      .filter(m => m.category === category)
      .sort((a, b) => b.importance - a.importance);
  }

  /**
   * Delete a memory
   */
  deleteMemory(id: string): boolean {
    const deleted = this.memories.delete(id);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  /**
   * Update memory importance
   */
  updateImportance(id: string, importance: number): boolean {
    const memory = this.memories.get(id);
    if (memory) {
      memory.importance = Math.max(1, Math.min(10, importance));
      this.saveToStorage();
      return true;
    }
    return false;
  }

  /**
   * Clear all memories
   */
  clearAll(): void {
    this.memories.clear();
    this.saveToStorage();
  }

  /**
   * Get statistics
   */
  getStats(): { total: number; byCategory: Record<string, number> } {
    const byCategory: Record<string, number> = {};
    
    for (const memory of this.memories.values()) {
      byCategory[memory.category] = (byCategory[memory.category] || 0) + 1;
    }
    
    return {
      total: this.memories.size,
      byCategory,
    };
  }

  /**
   * Extract tags from content
   */
  private extractTags(content: string): string[] {
    const words = content.toLowerCase().split(/\s+/);
    const tags = new Set<string>();
    
    // Extract significant words (length > 3)
    for (const word of words) {
      const clean = word.replace(/[^a-zäöüß]/g, '');
      if (clean.length > 3) {
        tags.add(clean);
      }
    }
    
    return Array.from(tags).slice(0, 10);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Prune memories if we exceed max
   */
  private pruneIfNeeded(): void {
    if (this.memories.size <= this.maxMemories) {
      return;
    }
    
    // Sort by importance and recency, remove least important
    const sorted = Array.from(this.memories.values())
      .sort((a, b) => {
        const scoreA = a.importance * (1 / (Date.now() - a.lastAccessed + 1));
        const scoreB = b.importance * (1 / (Date.now() - b.lastAccessed + 1));
        return scoreA - scoreB;
      });
    
    // Remove lowest scoring memories until we're under limit
    const toRemove = sorted.slice(0, Math.floor(this.maxMemories * 0.1));
    for (const mem of toRemove) {
      this.memories.delete(mem.id);
    }
  }

  /**
   * Save to localStorage (browser) or file (Electron)
   */
  private saveToStorage(): void {
    try {
      const data = JSON.stringify(Array.from(this.memories.entries()));
      localStorage.setItem('freeaiagentpro_memories', data);
    } catch (e) {
      console.warn('Could not save memories to storage:', e);
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem('freeaiagentpro_memories');
      if (data) {
        const entries = JSON.parse(data) as [string, Memory][];
        this.memories = new Map(entries);
      }
    } catch (e) {
      console.warn('Could not load memories from storage:', e);
    }
  }
}

// Export singleton instance
export const memoryService = new MemoryService();
