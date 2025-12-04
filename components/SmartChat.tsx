import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Send, MapPin, Search, Loader2, BrainCircuit } from 'lucide-react';
import { ChatMessage, Sender } from '../types';

interface SmartChatProps {
  apiKey: string;
}

const SmartChat: React.FC<SmartChatProps> = ({ apiKey }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: Sender.MODEL, text: 'Namaste! Ask me anything. I can check Google Maps for places or Search for news.', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useThinking, setUseThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: Sender.USER,
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      // Determine model and config based on toggle
      let model = 'gemini-2.5-flash';
      let config: any = {};
      
      if (useThinking) {
        // Complex reasoning requested
        model = 'gemini-3-pro-preview';
        config = {
          thinkingConfig: { thinkingBudget: 32768 }, // Max budget
        };
      } else {
        // General query - enable grounding tools
        // We let the model decide if it needs them, but we provide them
        // Note: For now, we will add both search and maps and let the model pick implicitly based on query
        // Or we can simple use flash for general speed
        config = {
             tools: [
                 { googleSearch: {} },
                 { googleMaps: {} }
             ]
        };
        
        // Add location context if possible
         if (navigator.geolocation) {
             try {
                const pos: GeolocationPosition = await new Promise((resolve, reject) => 
                    navigator.geolocation.getCurrentPosition(resolve, reject, {timeout: 5000})
                );
                 config.toolConfig = {
                    retrievalConfig: {
                        latLng: {
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude
                        }
                    }
                };
             } catch (e) {
                 console.warn("Location denied or failed", e);
             }
         }
      }

      const response = await ai.models.generateContent({
        model,
        contents: messages.map(m => ({
            role: m.role === Sender.USER ? 'user' : 'model',
            parts: [{ text: m.text }]
        })),
        config
      });

      const text = response.text || "I couldn't generate a text response.";
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: Sender.MODEL,
        text,
        timestamp: Date.now(),
        isThinking: useThinking,
        groundingMetadata
      };

      setMessages(prev => [...prev, modelMsg]);

    } catch (error) {
      console.error(error);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: Sender.MODEL,
        text: "Sorry, something went wrong. Please try again.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderGroundingSource = (metadata: any) => {
    if (!metadata?.groundingChunks) return null;

    const searchChunks = metadata.groundingChunks.filter((c: any) => c.web);
    const mapChunks = metadata.groundingChunks.filter((c: any) => c.maps); // Maps data isn't always in chunks in the same way, but checking for safety

    if (searchChunks.length === 0 && mapChunks.length === 0) return null;

    return (
      <div className="mt-2 text-xs border-t border-slate-200 pt-2">
        <p className="font-semibold text-slate-500 mb-1">Sources:</p>
        <div className="flex flex-wrap gap-2">
            {searchChunks.map((chunk: any, i: number) => (
            <a 
                key={i} 
                href={chunk.web.uri} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-blue-600 px-2 py-1 rounded transition-colors"
            >
                <Search size={10} />
                <span className="truncate max-w-[150px]">{chunk.web.title}</span>
            </a>
            ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === Sender.USER ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${
                msg.role === Sender.USER
                  ? 'bg-teal-600 text-white rounded-br-none'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
              }`}
            >
              {msg.isThinking && (
                  <div className="flex items-center gap-1 text-xs text-purple-600 mb-2 font-medium">
                      <BrainCircuit size={12} />
                      <span>Deep Thought Result</span>
                  </div>
              )}
              <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
              {msg.groundingMetadata && renderGroundingSource(msg.groundingMetadata)}
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                 <div className="bg-white p-4 rounded-2xl rounded-bl-none border border-slate-200 flex items-center gap-2">
                    <Loader2 className="animate-spin text-teal-600" size={20} />
                    <span className="text-slate-500 text-sm">Gemini is thinking...</span>
                 </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-200">
         <div className="flex items-center gap-2 mb-3">
             <label className="flex items-center gap-2 cursor-pointer select-none">
                 <div className={`w-10 h-6 rounded-full p-1 transition-colors ${useThinking ? 'bg-purple-600' : 'bg-slate-300'}`} onClick={() => setUseThinking(!useThinking)}>
                     <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${useThinking ? 'translate-x-4' : ''}`}></div>
                 </div>
                 <span className={`text-sm font-medium ${useThinking ? 'text-purple-700' : 'text-slate-500'}`}>
                     Thinking Mode (Complex Grammar)
                 </span>
             </label>
         </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={useThinking ? "Ask a complex grammar question..." : "Ask about news, places, or general topics..."}
            className="flex-1 p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-teal-600 text-white p-3 rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmartChat;
