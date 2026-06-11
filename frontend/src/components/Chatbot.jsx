import React, { useState } from 'react';
import { MessageSquare, X, Send } from 'lucide-react';
import { chatWithTutor } from '../services/api';

const Chatbot = ({ userContext, chapterId = null, userId = null, materialId = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I am Kenapse, your AI tutor. Ask me anything about this topic!' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      const data = await chatWithTutor(userMsg, userContext, chapterId, userId, materialId);
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I am having trouble connecting right now.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          className="btn btn-primary"
          style={{ position: 'fixed', bottom: '2rem', right: '2rem', borderRadius: '50%', width: '60px', height: '60px', padding: 0, zIndex: 1000 }}
          onClick={() => setIsOpen(true)}
        >
          <MessageSquare size={24} />
        </button>
      )}

      {isOpen && (
        <div className="glass-panel" style={{ position: 'fixed', bottom: '2rem', right: '2rem', width: '350px', height: '500px', display: 'flex', flexDirection: 'column', padding: 0, zIndex: 1000, overflow: 'hidden' }}>

          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Kenapse Tutor</h3>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-color)', cursor: 'pointer' }} onClick={() => setIsOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%', background: msg.role === 'user' ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)', padding: '10px 15px', borderRadius: '12px', borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px', borderBottomLeftRadius: msg.role === 'assistant' ? '2px' : '12px', fontSize: '0.9rem' }}>
                {msg.content}
              </div>
            ))}
            {isLoading && (
              <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.1)', padding: '10px 15px', borderRadius: '12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Thinking...
              </div>
            )}
          </div>

          <div style={{ padding: '1rem', borderTop: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)' }}>
            <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                className="input-field"
                placeholder="Ask a question..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                style={{ flex: 1, padding: '10px' }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '10px' }} disabled={isLoading}>
                <Send size={18} />
              </button>
            </form>
          </div>

        </div>
      )}
    </>
  );
};

export default Chatbot;
