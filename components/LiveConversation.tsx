import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Volume2, Globe, Wifi, WifiOff } from 'lucide-react';
import { createBlob, decodeAudioData, base64ToArrayBuffer } from '../utils/audioUtils';
import AudioVisualizer from './AudioVisualizer';

interface LiveConversationProps {
  apiKey: string;
}

const SYSTEM_INSTRUCTION = `
You are "LingoMate", a patient and friendly English tutor.
The user speaks Hindi and Kannada and is learning English.
Your goal is to have a conversation with them on any topic they like.
If they make a grammar mistake, correct them gently in English, but use Hindi or Kannada to explain *why* if the concept is difficult.
Encourage them to repeat phrases.
Keep your responses relatively short and conversational.
Speak slowly and clearly.
`;

const LiveConversation: React.FC<LiveConversationProps> = ({ apiKey }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Audio Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Visualizer Refs
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  
  // Logic Refs
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const cleanupAudio = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    
    // Stop all playing sources
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) { /* ignore */ }
    });
    sourcesRef.current.clear();
  };

  const startSession = async () => {
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey });
      
      // Initialize Audio Contexts
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Setup Output Node & Analyser
      outputNodeRef.current = outputAudioContextRef.current.createGain();
      outputAnalyserRef.current = outputAudioContextRef.current.createAnalyser();
      outputNodeRef.current.connect(outputAnalyserRef.current);
      outputAnalyserRef.current.connect(outputAudioContextRef.current.destination);
      
      // Setup Input Analyser
      inputAnalyserRef.current = inputAudioContextRef.current.createAnalyser();

      // Get Mic Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log('Session connected');
            setIsConnected(true);
            setIsTalking(true);

            // Setup Input Processing
            if (!inputAudioContextRef.current || !streamRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
            sourceRef.current = source;
            source.connect(inputAnalyserRef.current!); // Connect to visualizer

            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              }).catch(e => {
                  console.error("Error sending audio input:", e);
              });
            };

            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current && outputNodeRef.current) {
              const ctx = outputAudioContextRef.current;
              
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioBuffer = await decodeAudioData(
                base64ToArrayBuffer(base64Audio),
                ctx,
                24000,
                1
              );
              
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNodeRef.current);
              
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
              });

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(src => {
                try { src.stop(); } catch(e) {}
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            console.log('Session closed');
            setIsConnected(false);
            setIsTalking(false);
          },
          onerror: (err) => {
            console.error(err);
            setError("Connection error. Please try again.");
            setIsConnected(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
          },
          systemInstruction: SYSTEM_INSTRUCTION
        }
      });

      sessionRef.current = sessionPromise;

    } catch (err) {
      console.error(err);
      setError("Failed to access microphone or connect to AI.");
      cleanupAudio();
    }
  };

  const stopSession = async () => {
    if (sessionRef.current) {
      try {
          const session = await sessionRef.current;
          session.close();
      } catch (e) {
          console.error("Error closing session", e);
      }
      sessionRef.current = null;
    }
    cleanupAudio();
    setIsConnected(false);
    setIsTalking(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 space-y-8 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-800">Conversation Practice</h2>
        <p className="text-slate-600">Speak naturally. I will help you with English!</p>
        <p className="text-sm text-slate-500 flex items-center justify-center gap-2">
            <Globe className="w-4 h-4" /> Supports Hindi & Kannada explanations
        </p>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center gap-6 min-h-[300px] justify-center relative overflow-hidden">
        {isConnected ? (
          <>
            <div className="flex flex-col w-full gap-4">
               <div className="w-full bg-teal-50 rounded-lg p-2 border border-teal-100">
                 <p className="text-xs text-teal-600 font-bold mb-1 uppercase text-center">AI Voice</p>
                 <AudioVisualizer analyser={outputAnalyserRef.current} isActive={isConnected} color="#0d9488" />
               </div>
               <div className="w-full bg-orange-50 rounded-lg p-2 border border-orange-100">
                 <p className="text-xs text-orange-600 font-bold mb-1 uppercase text-center">Your Voice</p>
                 <AudioVisualizer analyser={inputAnalyserRef.current} isActive={isConnected} color="#ea580c" />
               </div>
            </div>
            <div className="absolute top-4 right-4 animate-pulse">
               <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
            </div>
          </>
        ) : (
           <div className="text-slate-300">
             <Volume2 size={80} />
           </div>
        )}
        
        {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
                {error}
            </div>
        )}
      </div>

      <div className="flex gap-4">
        {!isConnected ? (
          <button
            onClick={startSession}
            className="flex items-center gap-3 bg-teal-600 hover:bg-teal-700 text-white px-8 py-4 rounded-full text-xl font-semibold shadow-lg transition-all transform hover:scale-105"
          >
            <Mic size={24} />
            Start Talking
          </button>
        ) : (
          <button
            onClick={stopSession}
            className="flex items-center gap-3 bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-full text-xl font-semibold shadow-lg transition-all transform hover:scale-105"
          >
            <MicOff size={24} />
            End Call
          </button>
        )}
      </div>
      
      <div className="text-xs text-slate-400 flex items-center gap-1">
        {isConnected ? <Wifi className="w-3 h-3 text-green-500" /> : <WifiOff className="w-3 h-3" />}
        Status: {isConnected ? 'Connected to Gemini Live' : 'Disconnected'}
      </div>
    </div>
  );
};

export default LiveConversation;