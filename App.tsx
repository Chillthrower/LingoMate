import React, { useState } from 'react';
import { AppMode } from './types';
import LiveConversation from './components/LiveConversation';
import SmartChat from './components/SmartChat';
import PracticeTools from './components/PracticeTools';
import { MessageCircle, Mic, PenTool, BookOpen } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppMode>(AppMode.LIVE_CONVERSATION);
  const apiKey = process.env.API_KEY || '';

  if (!apiKey) {
    return (
      <div className="flex h-screen items-center justify-center bg-red-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Configuration Error</h1>
          <p className="text-slate-600">
            API Key is missing. This app requires a valid Google Gemini API key in the environment variables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 max-w-lg mx-auto shadow-2xl overflow-hidden relative border-x border-slate-200">
      
      {/* Header */}
      <header className="bg-teal-700 text-white p-4 shadow-lg z-10">
        <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold flex items-center gap-2">
                <BookOpen size={24} className="text-teal-200"/>
                LingoMate
            </h1>
            <span className="text-xs bg-teal-800 px-2 py-1 rounded-full text-teal-100">For Mom</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === AppMode.LIVE_CONVERSATION && <LiveConversation apiKey={apiKey} />}
        {activeTab === AppMode.SMART_CHAT && <SmartChat apiKey={apiKey} />}
        {activeTab === AppMode.PRACTICE_TOOLS && <PracticeTools apiKey={apiKey} />}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-slate-200 p-2 flex justify-around items-center pb-safe z-10">
        <button
          onClick={() => setActiveTab(AppMode.LIVE_CONVERSATION)}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all w-24 ${
            activeTab === AppMode.LIVE_CONVERSATION ? 'text-teal-600 bg-teal-50' : 'text-slate-400 hover:bg-slate-50'
          }`}
        >
          <Mic size={24} strokeWidth={activeTab === AppMode.LIVE_CONVERSATION ? 2.5 : 2} />
          <span className="text-xs font-medium">Talk</span>
        </button>

        <button
          onClick={() => setActiveTab(AppMode.SMART_CHAT)}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all w-24 ${
            activeTab === AppMode.SMART_CHAT ? 'text-teal-600 bg-teal-50' : 'text-slate-400 hover:bg-slate-50'
          }`}
        >
          <MessageCircle size={24} strokeWidth={activeTab === AppMode.SMART_CHAT ? 2.5 : 2} />
          <span className="text-xs font-medium">Chat</span>
        </button>

        <button
          onClick={() => setActiveTab(AppMode.PRACTICE_TOOLS)}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all w-24 ${
            activeTab === AppMode.PRACTICE_TOOLS ? 'text-teal-600 bg-teal-50' : 'text-slate-400 hover:bg-slate-50'
          }`}
        >
          <PenTool size={24} strokeWidth={activeTab === AppMode.PRACTICE_TOOLS ? 2.5 : 2} />
          <span className="text-xs font-medium">Practice</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
