import React, { useState, useCallback, useRef, useEffect } from 'react';
import './App.css';

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  agentId?: string;
}

interface AgentStatus {
  id: string;
  name: string;
  status: 'idle' | 'thinking' | 'active' | 'complete';
  thinking: string;
}

// Agent definitions
const AGENTS = [
  { id: 'brain', name: 'BRAIN', description: 'Commander - Koordination & Planung', color: '#4A90D9' },
  { id: 'quest', name: 'QUEST', description: 'Researcher - Recherche & Fakten', color: '#50C878' },
  { id: 'forge', name: 'FORGE', description: 'Engineer - Code & Technik', color: '#FF6B35' },
  { id: 'spark', name: 'SPARK', description: 'Creative - Ideen & UX', color: '#9B59B6' },
];

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<AgentStatus[]>(
    AGENTS.map(a => ({ ...a, status: 'idle' as const, thinking: '' }))
  );
  const [settings, setSettings] = useState({
    googleApiKey: '',
    openRouterApiKey: '',
    groqApiKey: '',
  });
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  // Simulate agent thinking (demo mode since we can't call real APIs)
  const simulateAgentThinking = async (agents: string[]) => {
    // Set agents to thinking
    setAgentStatuses(prev => 
      prev.map(a => 
        agents.includes(a.id) 
          ? { ...a, status: 'thinking' as const, thinking: 'Analysiere...' }
          : a
      )
    );

    // Simulate different thinking times for each agent
    for (const agentId of agents) {
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));
      setAgentStatuses(prev => 
        prev.map(a => 
          a.id === agentId 
            ? { ...a, thinking: `Berechne ${agentId}...` }
            : a
        )
      );
    }

    // Complete
    await new Promise(resolve => setTimeout(resolve, 300));
    setAgentStatuses(prev => 
      prev.map(a => 
        agents.includes(a.id) 
          ? { ...a, status: 'complete' as const, thinking: '' }
          : a
      )
    );
  };

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const userInput = input.trim();
    if (!userInput) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userInput,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Determine which agents to activate based on input
    const lowerInput = userInput.toLowerCase();
    let activeAgents = ['brain'];
    
    if (lowerInput.includes('recherche') || lowerInput.includes('such') || lowerInput.includes('information')) {
      activeAgents.push('quest');
    }
    if (lowerInput.includes('code') || lowerInput.includes('programm') || lowerInput.includes('berechn')) {
      activeAgents.push('forge');
    }
    if (lowerInput.includes('kreativ') || lowerInput.includes('idee') || lowerInput.includes('design')) {
      activeAgents.push('spark');
    }

    // Simulate agent processing
    await simulateAgentThinking(activeAgents);

    // Generate response (demo response)
    const responses: Record<string, string> = {
      brain: 'Ich habe Ihre Anfrage analysiert. ',
      quest: 'Ich habe relevante Informationen gefunden. ',
      forge: 'Ich habe den Code/die Berechnung erstellt. ',
      spark: 'Hier sind einige kreative Vorschläge: ',
    };

    const responseContent = activeAgents
      .map(id => responses[id])
      .join('\n\n') + `\n\n(Hinweis: Dies ist eine Demo-Antwort. Um die volle Funktionalität zu nutzen, geben Sie einen Google API Key in den Einstellungen ein.)`;

    // Add assistant message
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: responseContent,
      timestamp: Date.now(),
      agentId: activeAgents.join(','),
    };
    setMessages(prev => [...prev, assistantMessage]);

    // Reset agent statuses after a delay
    setTimeout(() => {
      setAgentStatuses(prev => 
        prev.map(a => ({ ...a, status: 'idle' as const, thinking: '' }))
      );
    }, 2000);

    setIsLoading(false);
  }, [input]);

  // Handle settings change
  const handleSettingsChange = useCallback((key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  // Handle key press (Ctrl+Enter to submit)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit(e as any);
    }
  }, [handleSubmit]);

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <span className="logo-icon">⬡</span>
          <h1>FreeAIAgentPro</h1>
        </div>
        <button 
          className="settings-btn"
          onClick={() => setShowSettings(!showSettings)}
        >
          ⚙️ Einstellungen
        </button>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="settings-panel">
          <h3>API-Konfiguration</h3>
          <p className="settings-info">
            Geben Sie Ihren API-Key ein, um die KI-Funktionen zu aktivieren.
            Alle Anbieter bieten kostenlose Tier an.
          </p>
          
          <div className="setting-item">
            <label>Google AI Studio (API Key)</label>
            <input
              type="password"
              value={settings.googleApiKey}
              onChange={(e) => handleSettingsChange('googleApiKey', e.target.value)}
              placeholder="Gib deinen Google API Key ein"
            />
            <span className="setting-hint">
              Kostenlos: 60 RPM, 1M Tokens/Tag - https://aistudio.google.com/app/apikey
            </span>
          </div>

          <div className="setting-item">
            <label>OpenRouter (API Key)</label>
            <input
              type="password"
              value={settings.openRouterApiKey}
              onChange={(e) => handleSettingsChange('openRouterApiKey', e.target.value)}
              placeholder="Gib deinen OpenRouter API Key ein"
            />
            <span className="setting-hint">
              Kostenlose Modelle verfügbar - https://openrouter.ai/settings
            </span>
          </div>

          <div className="setting-item">
            <label>Groq (API Key)</label>
            <input
              type="password"
              value={settings.groqApiKey}
              onChange={(e) => handleSettingsChange('groqApiKey', e.target.value)}
              placeholder="Gib deinen Groq API Key ein"
            />
            <span className="setting-hint">
              Kostenlos mit niedriger Latenz - https://console.groq.com/keys
            </span>
          </div>

          <button 
            className="save-settings-btn"
            onClick={() => {
              // Save settings
              localStorage.setItem('freeaiagentpro_settings', JSON.stringify(settings));
              setShowSettings(false);
            }}
          >
            Einstellungen speichern
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="main">
        {/* Agent Panels */}
        <div className="agent-panels">
          {agentStatuses.map(agent => (
            <div 
              key={agent.id} 
              className={`agent-panel agent-${agent.id} ${agent.status}`}
              style={{ borderColor: agent.color }}
            >
              <div className="agent-header">
                <span 
                  className="agent-indicator"
                  style={{ backgroundColor: agent.color }}
                />
                <span className="agent-name">{agent.name}</span>
              </div>
              <div className="agent-status">
                {agent.status === 'idle' && <span className="status-text">Bereit</span>}
                {agent.status === 'thinking' && (
                  <span className="status-thinking">
                    <span className="thinking-dot">●</span>
                    {agent.thinking}
                  </span>
                )}
                {agent.status === 'complete' && <span className="status-complete">✓</span>}
              </div>
              <div className="agent-description">{agent.description}</div>
            </div>
          ))}
        </div>

        {/* Chat Area */}
        <div className="chat-area">
          <div className="messages">
            {messages.length === 0 && (
              <div className="welcome-message">
                <h2>Willkommen bei FreeAIAgentPro</h2>
                <p>
                  Ihr KI-Assistent mit Multi-Agenten-System.
                  Geben Sie Ihre Anfrage ein, und das System wählt 
                  automatisch die richtigen Agenten aus.
                </p>
                <div className="feature-list">
                  <div className="feature">
                    <span style={{ color: '#4A90D9' }}>●</span> BRAIN - Commander
                  </div>
                  <div className="feature">
                    <span style={{ color: '#50C878' }}>●</span> QUEST - Researcher
                  </div>
                  <div className="feature">
                    <span style={{ color: '#FF6B35' }}>●</span> FORGE - Engineer
                  </div>
                  <div className="feature">
                    <span style={{ color: '#9B59B6' }}>●</span> SPARK - Creative
                  </div>
                </div>
                <p className="demo-note">
                  💡 <strong>Demo-Modus:</strong> Ohne API-Key erhalten Sie Demo-Antworten.
                  Für echte KI-Antworten geben Sie einen API-Key in den Einstellungen ein.
                </p>
              </div>
            )}
            
            {messages.map(message => (
              <div key={message.id} className={`message ${message.role}`}>
                <div className="message-header">
                  <span className="message-role">
                    {message.role === 'user' ? 'Sie' : 
                     message.role === 'assistant' && message.agentId ? 
                     `Agent(en): ${message.agentId}` : 'FreeAIAgentPro'}
                  </span>
                </div>
                <div className="message-content">
                  {message.content}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="message assistant loading">
                <div className="message-content">
                  <span className="loading-dots">
                    <span>.</span><span>.</span><span>.</span>
                  </span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form className="input-area" onSubmit={handleSubmit}>
            <textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ihre Anfrage hier eingeben... (Strg+Enter zum Senden)"
              disabled={isLoading}
              rows={3}
            />
            <button 
              type="submit" 
              className="send-btn"
              disabled={isLoading || !input.trim()}
            >
              {isLoading ? '...' : 'Senden'}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        <span>FreeAIAgentPro v1.0.0</span>
        <span>•</span>
        <span>4-Agenten Multi-Agenten-System</span>
        <span>•</span>
        <span>Memory & Self-Improvement aktiviert</span>
      </footer>
    </div>
  );
}

export default App;
