import React, { useState, useContext, useRef, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { askAI } from '../services/api';

export const AIChatbot = () => {
  const auth = useContext(AuthContext);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'ai', text: string, time: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  if (!auth?.isAuthenticated) return null;

  const getTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !auth.token) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMessage, time: getTime() }]);
    setInput('');
    setLoading(true);

    try {
      const response = await askAI(userMessage, auth.token);
      setMessages(prev => [...prev, { role: 'ai', text: response.reply, time: getTime() }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', text: err.message || 'Something went wrong.', time: getTime() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  // Format AI text: bold, bullets etc.
  const formatAIText = (text: string) => {
    return text.split('\n').map((line, idx) => {
      // Bold text **text**
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const formatted = parts.map((part, pi) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pi} style={{color: '#14b8a6'}}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      // Bullet points
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return <div key={idx} style={{paddingLeft: '12px', position: 'relative', marginBottom: '2px'}}>
          <span style={{position: 'absolute', left: 0, color: '#14b8a6'}}>•</span>
          {formatted.map((f, fi) => typeof f === 'string' ? f.replace(/^[\s]*[-*]\s/, '') : f)}
        </div>;
      }

      return <React.Fragment key={idx}>{formatted}{idx < text.split('\n').length - 1 && <br/>}</React.Fragment>;
    });
  };

  return (
    <>
      {/* Floating Button */}
      <button 
        className={`ai-fab ${isOpen ? 'ai-fab--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Ask AI Assistant"
      >
        <span className="ai-fab__icon">{isOpen ? '✕' : '✨'}</span>
        <span className="ai-fab__pulse"></span>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="ai-window">
          {/* Header */}
          <div className="ai-window__header">
            <div className="ai-window__header-left">
              <div className="ai-avatar ai-avatar--header">
                <span>🤖</span>
                <span className="ai-avatar__status"></span>
              </div>
              <div>
                <h3 className="ai-window__title">TailorApp AI</h3>
                <p className="ai-window__subtitle">{loading ? 'Typing...' : 'Online'}</p>
              </div>
            </div>
            <button className="ai-window__clear" onClick={handleClear} title="Clear chat">
              🗑️
            </button>
          </div>
          
          {/* Messages */}
          <div className="ai-messages">
            {messages.length === 0 && (
              <div className="ai-welcome">
                <div className="ai-welcome__icon">✨</div>
                <h4 className="ai-welcome__title">Hi there!</h4>
                <p className="ai-welcome__text">
                  I'm your AI assistant. Ask me about stock, orders, or tailoring costs!
                </p>
                <div className="ai-welcome__suggestions">
                  {['Stock e ki ache?', 'Pending orders koto?', 'Suit er cost?'].map((q, i) => (
                    <button key={i} className="ai-welcome__chip" onClick={() => { setInput(q); }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role === 'user' ? 'ai-msg--user' : 'ai-msg--bot'}`}>
                {m.role === 'ai' && (
                  <div className="ai-avatar ai-avatar--small">🤖</div>
                )}
                <div className={`ai-msg__bubble ${m.role === 'user' ? 'ai-msg__bubble--user' : 'ai-msg__bubble--bot'}`}>
                  <div className="ai-msg__text">
                    {m.role === 'ai' ? formatAIText(m.text) : m.text}
                  </div>
                  <span className="ai-msg__time">{m.time}</span>
                </div>
                {m.role === 'user' && (
                  <div className="ai-avatar ai-avatar--small ai-avatar--user">👤</div>
                )}
              </div>
            ))}
            
            {loading && (
              <div className="ai-msg ai-msg--bot">
                <div className="ai-avatar ai-avatar--small">🤖</div>
                <div className="ai-msg__bubble ai-msg__bubble--bot">
                  <div className="ai-typing">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="ai-input-area">
            <input 
              ref={inputRef}
              type="text" 
              className="ai-input-area__field" 
              placeholder="Type your question..." 
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
            />
            <button 
              type="submit" 
              className={`ai-input-area__send ${input.trim() ? 'ai-input-area__send--active' : ''}`}
              disabled={loading || !input.trim()}
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
};
