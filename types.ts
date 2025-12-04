export enum AppMode {
  LIVE_CONVERSATION = 'LIVE_CONVERSATION',
  SMART_CHAT = 'SMART_CHAT',
  PRACTICE_TOOLS = 'PRACTICE_TOOLS'
}

export enum Sender {
  USER = 'user',
  MODEL = 'model'
}

export interface ChatMessage {
  id: string;
  role: Sender;
  text: string;
  timestamp: number;
  isThinking?: boolean;
  groundingMetadata?: any;
}

export interface VoiceConfig {
  voiceName: string;
}

// Audio Utils Types
export interface AudioContextState {
  inputAudioContext: AudioContext | null;
  outputAudioContext: AudioContext | null;
  inputNode: GainNode | null;
  outputNode: GainNode | null;
}
