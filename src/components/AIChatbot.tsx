import React, { useState, useContext, useRef, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { askAI } from '../services/api';

export const AIChatbot = () => {
  const auth = useContext(AuthContext);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!auth?.isAuthenticated) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !auth.token) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      const response = await askAI(userMessage, auth.token);
      setMessages(prev => [...prev, { role: 'ai', text: response.reply }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', text: err.message || 'Something went wrong.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        className="ai-chat-btn" 
        onClick={() => setIsOpen(!isOpen)}
        title="Ask AI Assistant"
      >
        ✨
      </button>

      {isOpen && (
        <div className="ai-chat-window glass-card">
          <div className="ai-chat-header border-b border-white/10 pb-3 mb-3 flex justify-between items-center">
            <h3 className="font-bold text-accent">✨ TailorApp AI</h3>
            <button onClick={() => setIsOpen(false)} className="text-secondary hover:text-white">✕</button>
          </div>
          
          <div className="ai-chat-messages custom-scrollbar">
            {messages.length === 0 && (
              <p className="text-secondary text-sm text-center mt-10">
                Hi! Ask me about your stock, order status, or tailoring costs.
              </p>
            )}
            
            {messages.map((m, i) => (
              <div key={i} className={`mb-3 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${m.role === 'user' ? 'bg-accent text-white rounded-tr-none' : 'bg-white/10 text-white rounded-tl-none'}`}>
                  {m.text.split('\n').map((line, idx) => <React.Fragment key={idx}>{line}<br/></React.Fragment>)}
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="mb-3 flex justify-start">
                <div className="px-4 py-2 rounded-2xl max-w-[85%] text-sm bg-white/10 text-secondary rounded-tl-none flex gap-1">
                  <span className="animate-bounce">.</span><span className="animate-bounce" style={{animationDelay: '150ms'}}>.</span><span className="animate-bounce" style={{animationDelay: '300ms'}}>.</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="ai-chat-input-area border-t border-white/10 pt-3 mt-3 flex gap-2">
            <input 
              type="text" 
              className="glass-input flex-1 !py-2 !px-3 text-sm" 
              placeholder="Ask anything..." 
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="btn-primary !py-2 !px-4" disabled={loading || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
};
