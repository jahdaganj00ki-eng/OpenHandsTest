/**
 * FreeAIAgentPro - API Service
 * 
 * Handles communication with free AI providers:
 * - Google AI Studio (Gemini 2.5 Flash) - Primary
 * - OpenRouter - Fallback
 * - Groq - Fallback
 * - Cloudflare Workers AI - Fallback
 */

import { 
  BRAIN_PROMPT, 
  QUEST_PROMPT, 
  FORGE_PROMPT, 
  SPARK_PROMPT,
  DEFAULT_SYSTEM_PROMPT 
} from '../prompts/agentPrompts';

export interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface ApiProvider {
  name: string;
  baseUrl: string;
  headers: Record<string, string>;
  model: string;
  maxTokens: number;
  isHealthy: boolean;
  lastCheck: number;
}

export interface AgentResponse {
  agentId: string;
  content: string;
  duration: number;
  success: boolean;
  error?: string;
}

// API Providers configuration
const GOOGLE_AI_URL = 'https://generativelanguage.googleapis.com/v1beta';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1';
const GROQ_URL = 'https://api.groq.com/openai/v1';

class ApiService {
  private providers: ApiProvider[] = [];
  private activeProvider: number = 0;
  private requestQueue: Array<{
    resolve: (value: string) => void;
    reject: (reason: Error) => void;
    prompt: string;
    options: GenerateOptions;
  }> = [];
  private isProcessing: boolean = false;
  private retryCount: number = 3;
  private retryDelay: number = 1000;

  constructor() {
    this.initProviders();
  }

  private initProviders(): void {
    this.providers = [
      {
        name: 'Google AI Studio',
        baseUrl: GOOGLE_AI_URL,
        headers: {
          'Content-Type': 'application/json',
        },
        model: 'gemini-2.0-flash-exp',
        maxTokens: 8192,
        isHealthy: true,
        lastCheck: Date.now(),
      },
      {
        name: 'OpenRouter',
        baseUrl: OPENROUTER_URL,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || ''}`,
        },
        model: 'google/gemini-2.0-flash-001',
        maxTokens: 8192,
        isHealthy: true,
        lastCheck: Date.now(),
      },
      {
        name: 'Groq',
        baseUrl: GROQ_URL,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY || ''}`,
        },
        model: 'llama-3.3-70b-versatile',
        maxTokens: 8192,
        isHealthy: true,
        lastCheck: Date.now(),
      },
    ];
  }

  /**
   * Generate response using the active provider
   */
  async generate(prompt: string, systemPrompt: string = DEFAULT_SYSTEM_PROMPT, options: GenerateOptions = {}): Promise<string> {
    const { model, temperature = 0.7, maxTokens = 4096 } = options;
    
    // Try each provider in sequence
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[(this.activeProvider + i) % this.providers.length];
      
      if (!provider.isHealthy) continue;

      try {
        const response = await this.callProvider(provider, prompt, systemPrompt, {
          model: model || provider.model,
          temperature,
          maxTokens: Math.min(maxTokens, provider.maxTokens),
        });
        
        // Move successful provider to front
        if (i > 0) {
          this.activeProvider = (this.activeProvider + i) % this.providers.length;
        }
        
        return response;
      } catch (error) {
        console.error(`Provider ${provider.name} failed:`, error);
        provider.isHealthy = false;
        
        // Try next provider
        if (i === this.providers.length - 1) {
          throw new Error('All providers failed');
        }
      }
    }

    throw new Error('No available providers');
  }

  /**
   * Call a specific provider
   */
  private async callProvider(
    provider: ApiProvider,
    userPrompt: string,
    systemPrompt: string,
    options: { model: string; temperature: number; maxTokens: number }
  ): Promise<string> {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    if (provider.name === 'Google AI Studio') {
      return this.callGoogleAI(provider, messages, options);
    } else if (provider.name === 'OpenRouter' || provider.name === 'Groq') {
      return this.callOpenAICompatible(provider, messages, options);
    }

    throw new Error(`Unknown provider: ${provider.name}`);
  }

  /**
   * Call Google AI Studio (Gemini)
   */
  private async callGoogleAI(
    provider: ApiProvider,
    messages: Array<{ role: string; content: string }>,
    options: { model: string; temperature: number; maxTokens: number }
  ): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY || '';
    
    if (!apiKey) {
      throw new Error('Google API key not configured');
    }

    const response = await fetch(
      `${provider.baseUrl}/models/${options.model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: messages.map(m => ({
            role: m.role === 'system' ? 'user' : m.role,
            parts: [{ text: m.content }],
          })),
          generationConfig: {
            temperature: options.temperature,
            maxOutputTokens: options.maxTokens,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google AI error: ${error}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates[0]) {
      return data.candidates[0].content.parts[0].text;
    }

    throw new Error('No response from Google AI');
  }

  /**
   * Call OpenAI-compatible APIs (OpenRouter, Groq)
   */
  private async callOpenAICompatible(
    provider: ApiProvider,
    messages: Array<{ role: string; content: string }>,
    options: { model: string; temperature: number; maxTokens: number }
  ): Promise<string> {
    // Skip if no API key configured
    if (!provider.headers['Authorization'] || provider.headers['Authorization'] === 'Bearer ') {
      throw new Error(`${provider.name} API key not configured`);
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: provider.headers,
      body: JSON.stringify({
        model: options.model,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${provider.name} error: ${error}`);
    }

    const data = await response.json();

    if (data.choices && data.choices[0]) {
      return data.choices[0].message.content;
    }

    throw new Error('No response from API');
  }

  /**
   * Process request with a specific agent
   */
  async callAgent(
    agentId: string,
    userInput: string,
    context: Record<string, unknown> = {}
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    const prompts = {
      brain: BRAIN_PROMPT,
      quest: QUEST_PROMPT,
      forge: FORGE_PROMPT,
      spark: SPARK_PROMPT,
    };

    const systemPrompt = prompts[agentId as keyof typeof prompts] || DEFAULT_SYSTEM_PROMPT;
    const enhancedPrompt = `${userInput}\n\nKontext: ${JSON.stringify(context)}`;

    try {
      const content = await this.generate(enhancedPrompt, systemPrompt);
      
      return {
        agentId,
        content,
        duration: Date.now() - startTime,
        success: true,
      };
    } catch (error) {
      return {
        agentId,
        content: '',
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get list of available providers
   */
  getProviders(): ApiProvider[] {
    return this.providers;
  }

  /**
   * Check health of all providers
   */
  async checkHealth(): Promise<void> {
    for (const provider of this.providers) {
      provider.lastCheck = Date.now();
      // Basic health check - in production, you'd make a test request
      provider.isHealthy = true;
    }
  }

  /**
   * Configure API key for a provider
   */
  setApiKey(providerName: string, apiKey: string): void {
    const provider = this.providers.find(p => p.name === providerName);
    if (provider) {
      provider.headers['Authorization'] = `Bearer ${apiKey}`;
      provider.isHealthy = true;
    }
  }

  /**
   * Get current provider status
   */
  getStatus(): { provider: string; healthy: boolean }[] {
    return this.providers.map(p => ({
      provider: p.name,
      healthy: p.isHealthy,
    }));
  }
}

// Export singleton instance
export const apiService = new ApiService();
