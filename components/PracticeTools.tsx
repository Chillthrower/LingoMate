import React, { useState, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Play, Mic, MicOff, Check, AlertCircle, Bolt } from 'lucide-react';
import { base64ToArrayBuffer, decodeAudioData } from '../utils/audioUtils';

interface PracticeToolsProps {
  apiKey: string;
}

const PracticeTools: React.FC<PracticeToolsProps> = ({ apiKey }) => {
  // TTS State
  const [ttsText, setTtsText] = useState('');
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  
  // Transcription State
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  // Fast Check State
  const [checkText, setCheckText] = useState('');
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Audio Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 1. Generate Speech (TTS)
  const handleTTS = async () => {
    if (!ttsText.trim() || isPlayingTTS) return;
    setIsPlayingTTS(true);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: ttsText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }, // Nice female voice
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const audioBuffer = await decodeAudioData(base64ToArrayBuffer(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => setIsPlayingTTS(false);
        source.start();
      } else {
          setIsPlayingTTS(false);
      }
    } catch (error) {
      console.error(error);
      setIsPlayingTTS(false);
    }
  };

  // 2. Transcribe Audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' }); // Usually webm/wav
        // Convert Blob to Base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const base64Content = base64data.split(',')[1]; // Remove header
          
          await transcribe(base64Content, audioBlob.type);
        };
        
        // Stop tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic error", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribe = async (base64Audio: string, mimeType: string) => {
    setTranscript("Transcribing...");
    try {
       const ai = new GoogleGenAI({ apiKey });
       const response = await ai.models.generateContent({
           model: 'gemini-2.5-flash', // Flash is good for transcription
           contents: {
               parts: [
                   { inlineData: { mimeType: mimeType, data: base64Audio } },
                   { text: "Transcribe this audio exactly as spoken." }
               ]
           }
       });
       setTranscript(response.text || "No speech detected.");
    } catch (e) {
        console.error(e);
        setTranscript("Error transcribing.");
    }
  };

  // 3. Fast Check (Flash Lite)
  const handleFastCheck = async () => {
      if(!checkText.trim()) return;
      setIsChecking(true);
      try {
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
              // Fixed model name from 'gemini-2.5-flash-lite-latest' to valid alias 'gemini-flash-lite-latest'
              model: 'gemini-flash-lite-latest', 
              contents: [{
                  role: 'user',
                  parts: [{ text: `Check this sentence for grammar. If correct, say "Correct". If incorrect, correct it and explain briefly in Hindi. Sentence: "${checkText}"`}]
              }]
          });
          setCheckResult(response.text || "");
      } catch (e) {
          console.error(e);
          setCheckResult("Error checking.");
      } finally {
          setIsChecking(false);
      }
  };

  return (
    <div className="p-6 space-y-8 h-full overflow-y-auto bg-slate-50">
      
      {/* TTS Section */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Play className="text-teal-600" /> Listen to English
        </h3>
        <p className="text-sm text-slate-500 mb-3">Type a phrase to hear how it sounds.</p>
        <div className="flex gap-2">
            <input 
                type="text" 
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value)}
                placeholder="e.g., How are you today?"
                className="flex-1 p-3 border border-slate-300 rounded-lg"
            />
            <button 
                onClick={handleTTS}
                disabled={isPlayingTTS || !ttsText}
                className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
                {isPlayingTTS ? 'Playing...' : 'Speak'}
            </button>
        </div>
      </section>

      {/* Transcription Section */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Mic className="text-orange-600" /> Check Your Pronunciation
        </h3>
        <p className="text-sm text-slate-500 mb-3">Record yourself, and see what the AI hears.</p>
        <div className="flex flex-col items-center gap-4">
            <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                    isRecording ? 'bg-red-500 scale-110 shadow-red-200' : 'bg-orange-500 hover:bg-orange-600'
                } text-white shadow-xl cursor-pointer select-none`}
            >
                {isRecording ? <MicOff size={32} /> : <Mic size={32} />}
            </button>
            <p className="text-xs text-slate-400">Hold to record</p>
            
            {transcript && (
                <div className="w-full bg-slate-50 p-4 rounded-lg border border-slate-200 mt-2">
                    <p className="font-semibold text-slate-600 text-xs uppercase mb-1">Transcription:</p>
                    <p className="text-lg text-slate-800">"{transcript}"</p>
                </div>
            )}
        </div>
      </section>

      {/* Fast Check Section */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
         <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Bolt className="text-yellow-500" /> Fast Grammar Check
        </h3>
        <p className="text-sm text-slate-500 mb-3">Quickly check a sentence (uses Flash-Lite).</p>
        <div className="space-y-3">
             <div className="flex gap-2">
                <input 
                    type="text" 
                    value={checkText}
                    onChange={(e) => setCheckText(e.target.value)}
                    placeholder="e.g., I going to market yesterday."
                    className="flex-1 p-3 border border-slate-300 rounded-lg"
                />
                <button 
                    onClick={handleFastCheck}
                    disabled={isChecking || !checkText}
                    className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 disabled:opacity-50"
                >
                    {isChecking ? 'Checking...' : 'Check'}
                </button>
            </div>
            {checkResult && (
                 <div className={`w-full p-4 rounded-lg border mt-2 flex gap-3 ${checkResult.toLowerCase().includes('correct') && !checkResult.toLowerCase().includes('incorrect') ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                    {checkResult.toLowerCase().includes('correct') && !checkResult.toLowerCase().includes('incorrect') ? <Check className="text-green-600 shrink-0" /> : <AlertCircle className="text-yellow-600 shrink-0" />}
                    <p className="text-slate-800">{checkResult}</p>
                </div>
            )}
        </div>
      </section>
    </div>
  );
};

export default PracticeTools;