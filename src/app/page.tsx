'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Mic, Play, Download, Trash2, Music, Brain, AudioLines, Wand2, Copy, Save, User } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const PRESET_SPEAKERS = [
  { id: 'Serena', name: 'Serena', description: 'Female, gentle' },
  { id: 'Aiden', name: 'Aiden', description: 'Male, warm' },
  { id: 'Dylan', name: 'Dylan', description: 'Male, energetic' },
  { id: 'Eric', name: 'Eric', description: 'Male, professional' },
  { id: 'Ryan', name: 'Ryan', description: 'Male, casual' },
  { id: 'Vivian', name: 'Vivian', description: 'Female, bright' },
  { id: 'Ono_anna', name: 'Ono Anna', description: 'Female, Japanese' },
  { id: 'Sohee', name: 'Sohee', description: 'Female, Korean' },
  { id: 'Uncle_fu', name: 'Uncle Fu', description: 'Male, Chinese' },
];

const LANGUAGES = [
  { id: 'auto', name: 'Auto Detect' },
  { id: 'English', name: 'English' },
  { id: 'Chinese', name: 'Chinese' },
  { id: 'Japanese', name: 'Japanese' },
  { id: 'Korean', name: 'Korean' },
  { id: 'French', name: 'French' },
  { id: 'German', name: 'German' },
  { id: 'Spanish', name: 'Spanish' },
  { id: 'Portuguese', name: 'Portuguese' },
  { id: 'Russian', name: 'Russian' },
];

interface GeneratedAudio {
  id: string;
  text: string;
  mode: string;
  speaker?: string;
  audioUrl: string;
  createdAt: Date;
}

interface SavedVoice {
  id: string;
  name: string;
  audioDataUrl: string; // base64 data URL of the reference audio
  referenceText: string;
  createdAt: string;
}

export default function VoiceGeneratorPage() {
  const [text, setText] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('Serena');
  const [language, setLanguage] = useState('auto');
  const [styleInstruction, setStyleInstruction] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAudios, setGeneratedAudios] = useState<GeneratedAudio[]>([]);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);

  // Voice Clone states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [referenceText, setReferenceText] = useState('');
  const [cloneText, setCloneText] = useState('');
  const [voiceName, setVoiceName] = useState('');
  const [savedVoices, setSavedVoices] = useState<SavedVoice[]>([]);
  const [selectedSavedVoice, setSelectedSavedVoice] = useState<string>('');
  const [useMode, setUseMode] = useState<'record' | 'saved'>('record');

  // Voice Design states
  const [voiceDescription, setVoiceDescription] = useState('');
  const [designText, setDesignText] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved voices from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('savedVoices');
    if (saved) {
      try {
        setSavedVoices(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved voices', e);
      }
    }
  }, []);

  // Save voices to localStorage when changed
  useEffect(() => {
    if (savedVoices.length > 0) {
      localStorage.setItem('savedVoices', JSON.stringify(savedVoices));
    }
  }, [savedVoices]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const blobToDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const saveVoice = async () => {
    if (!recordingBlob) {
      toast({ title: 'Error', description: 'No recording to save', variant: 'destructive' });
      return;
    }
    if (!voiceName.trim()) {
      toast({ title: 'Error', description: 'Please enter a name for this voice', variant: 'destructive' });
      return;
    }

    try {
      const audioDataUrl = await blobToDataUrl(recordingBlob);
      const newVoice: SavedVoice = {
        id: `voice-${Date.now()}`,
        name: voiceName.trim(),
        audioDataUrl,
        referenceText: referenceText.trim(),
        createdAt: new Date().toISOString(),
      };

      setSavedVoices(prev => [...prev, newVoice]);
      setVoiceName('');
      toast({ title: 'Success', description: `Voice "${newVoice.name}" saved successfully` });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save voice', variant: 'destructive' });
    }
  };

  const deleteVoice = (id: string) => {
    setSavedVoices(prev => {
      const updated = prev.filter(v => v.id !== id);
      if (updated.length === 0) {
        localStorage.removeItem('savedVoices');
      }
      return updated;
    });
    if (selectedSavedVoice === id) {
      setSelectedSavedVoice('');
    }
    toast({ title: 'Deleted', description: 'Voice removed' });
  };

  const handleGenerate = async (mode: 'custom_voice' | 'voice_clone' | 'voice_design') => {
    let inputText = '';
    const body: Record<string, string> = { mode, language };

    if (mode === 'custom_voice') {
      inputText = text;
      body.text = text.trim();
      body.speaker = selectedSpeaker;
    } else if (mode === 'voice_clone') {
      inputText = cloneText;
      body.text = cloneText.trim();

      let audioToUpload: Blob | null = null;
      let refText = '';

      if (useMode === 'saved' && selectedSavedVoice) {
        // Use saved voice
        const voice = savedVoices.find(v => v.id === selectedSavedVoice);
        if (!voice) {
          toast({ title: 'Error', description: 'Selected voice not found', variant: 'destructive' });
          return;
        }
        // Convert data URL back to blob
        const response = await fetch(voice.audioDataUrl);
        audioToUpload = await response.blob();
        refText = voice.referenceText;
      } else {
        // Use new recording
        if (!recordingBlob) {
          toast({ title: 'Error', description: 'Please record your voice first', variant: 'destructive' });
          return;
        }
        audioToUpload = recordingBlob;
        refText = referenceText;
      }

      // Upload the audio
      const formData = new FormData();
      formData.append('audio', audioToUpload, 'recording.wav');

      try {
        const uploadRes = await fetch('/api/tts', { method: 'PUT', body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error);
        body.reference_audio = uploadData.url;
        if (refText.trim()) body.reference_text = refText.trim();
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to upload audio', variant: 'destructive' });
        return;
      }
    } else if (mode === 'voice_design') {
      inputText = designText;
      body.text = designText.trim();
      body.voice_description = voiceDescription.trim();
      if (!voiceDescription.trim()) {
        toast({ title: 'Error', description: 'Please describe the voice you want', variant: 'destructive' });
        return;
      }
    }

    if (!inputText.trim()) {
      toast({ title: 'Error', description: 'Please enter text to convert', variant: 'destructive' });
      return;
    }

    if (styleInstruction.trim()) {
      body.style_instruction = styleInstruction.trim();
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate speech');
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);

      const newAudio: GeneratedAudio = {
        id: Date.now().toString(),
        text: inputText.trim(),
        mode,
        speaker: mode === 'custom_voice' ? selectedSpeaker : undefined,
        audioUrl,
        createdAt: new Date(),
      };

      setGeneratedAudios((prev) => [newAudio, ...prev]);
      setCurrentAudio(audioUrl);
      toast({ title: 'Success', description: 'Speech generated successfully' });
    } catch (error) {
      console.error('Generate error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate speech',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = (id: string) => {
    setGeneratedAudios((prev) => {
      const audio = prev.find((a) => a.id === id);
      if (audio?.audioUrl.startsWith('blob:')) URL.revokeObjectURL(audio.audioUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  const handleDownload = (audio: GeneratedAudio) => {
    const link = document.createElement('a');
    link.href = audio.audioUrl;
    link.download = `qwen3-tts-${audio.mode}-${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const startRecording = async () => {
    console.log('startRecording called');
    try {
      if (typeof window === 'undefined') {
        console.error('window is undefined');
        toast({ title: 'Error', description: 'Audio recording not supported (no window)', variant: 'destructive' });
        return;
      }
      if (!navigator.mediaDevices) {
        console.error('navigator.mediaDevices is undefined - HTTPS required?');
        toast({ title: 'Error', description: 'Audio recording not supported. Make sure you\'re on HTTPS or localhost.', variant: 'destructive' });
        return;
      }
      if (!navigator.mediaDevices.getUserMedia) {
        console.error('getUserMedia not available');
        toast({ title: 'Error', description: 'getUserMedia not available in this browser', variant: 'destructive' });
        return;
      }
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted', stream);
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setRecordingBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setRecordingUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({ title: 'Error', description: 'Could not access microphone', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 pb-24">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-3">
              <div className="p-3 bg-primary rounded-xl">
                <Brain className="w-8 h-8 text-primary-foreground" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Qwen3 Voice Cloner
              </h1>
            </div>
            <p className="text-muted-foreground">
              Generate speech, clone voices, or design new voices with AI
            </p>
          </div>

          <Tabs defaultValue="preset" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="preset">Preset Voice</TabsTrigger>
              <TabsTrigger value="clone">Voice Clone</TabsTrigger>
              <TabsTrigger value="design">Voice Design</TabsTrigger>
              <TabsTrigger value="saved">My Voices</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            {/* Preset Voice Tab */}
            <TabsContent value="preset" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Music className="w-5 h-5" />
                    Text to Speech
                  </CardTitle>
                  <CardDescription>Use preset speaker voices</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Text to speak ({text.length}/2000)</Label>
                    <Textarea
                      placeholder="Enter text to convert to speech..."
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={4}
                      maxLength={2000}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Speaker</Label>
                      <Select value={selectedSpeaker} onValueChange={setSelectedSpeaker}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PRESET_SPEAKERS.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} - {s.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LANGUAGES.map((l) => (
                            <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Style Instruction (optional)</Label>
                    <Input
                      placeholder="e.g., speak slowly and calmly, excited tone..."
                      value={styleInstruction}
                      onChange={(e) => setStyleInstruction(e.target.value)}
                    />
                  </div>

                  <Button
                    onClick={() => handleGenerate('custom_voice')}
                    disabled={isGenerating || !text.trim()}
                    className="w-full"
                    size="lg"
                  >
                    {isGenerating ? 'Generating...' : 'Generate Speech'}
                  </Button>

                  {currentAudio && (
                    <div className="space-y-2">
                      <audio key={currentAudio} controls autoPlay className="w-full">
                        <source src={currentAudio} type="audio/wav" />
                      </audio>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = currentAudio;
                          link.download = `qwen3-tts-preset-${Date.now()}.wav`;
                          link.click();
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Save as WAV
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Voice Clone Tab */}
            <TabsContent value="clone" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Copy className="w-5 h-5" />
                    Voice Cloning
                  </CardTitle>
                  <CardDescription>Clone a voice from audio or use a saved voice</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Toggle between record new and use saved */}
                  <div className="flex gap-2">
                    <Button
                      variant={useMode === 'record' ? 'default' : 'outline'}
                      onClick={() => setUseMode('record')}
                      className="flex-1"
                    >
                      <Mic className="mr-2 h-4 w-4" />
                      Record New
                    </Button>
                    <Button
                      variant={useMode === 'saved' ? 'default' : 'outline'}
                      onClick={() => setUseMode('saved')}
                      className="flex-1"
                      disabled={savedVoices.length === 0}
                    >
                      <User className="mr-2 h-4 w-4" />
                      Use Saved ({savedVoices.length})
                    </Button>
                  </div>

                  {useMode === 'record' ? (
                    <>
                      <div className="space-y-2">
                        <Label>1. Record your voice sample (3+ seconds)</Label>
                        <div className="flex gap-2 items-center">
                          {!recordingUrl ? (
                            !isRecording ? (
                              <Button onClick={startRecording} variant="outline">
                                <AudioLines className="mr-2 h-4 w-4" />
                                Start Recording
                              </Button>
                            ) : (
                              <Button onClick={stopRecording} variant="destructive">
                                <AudioLines className="mr-2 h-4 w-4" />
                                Stop ({formatTime(recordingTime)})
                              </Button>
                            )
                          ) : (
                            <Button onClick={() => { setRecordingUrl(null); setRecordingBlob(null); }} variant="outline">
                              Re-record
                            </Button>
                          )}
                          {isRecording && (
                            <div className="flex items-center gap-2 text-destructive">
                              <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                              Recording...
                            </div>
                          )}
                        </div>
                        {recordingUrl && (
                          <audio controls className="w-full mt-2">
                            <source src={recordingUrl} type="audio/wav" />
                          </audio>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>2. Reference text (what you said - optional but recommended)</Label>
                        <Input
                          placeholder="Type what you said in the recording..."
                          value={referenceText}
                          onChange={(e) => setReferenceText(e.target.value)}
                        />
                      </div>

                      {/* Save voice option */}
                      {recordingBlob && (
                        <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
                          <Label>Save this voice for reuse</Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Voice name (e.g., My Voice)"
                              value={voiceName}
                              onChange={(e) => setVoiceName(e.target.value)}
                            />
                            <Button onClick={saveVoice} disabled={!voiceName.trim()}>
                              <Save className="mr-2 h-4 w-4" />
                              Save
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-2">
                      <Label>Select a saved voice</Label>
                      <Select value={selectedSavedVoice} onValueChange={setSelectedSavedVoice}>
                        <SelectTrigger><SelectValue placeholder="Choose a voice..." /></SelectTrigger>
                        <SelectContent>
                          {savedVoices.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedSavedVoice && (
                        <p className="text-sm text-muted-foreground">
                          Reference: {savedVoices.find(v => v.id === selectedSavedVoice)?.referenceText || '(none)'}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>{useMode === 'record' ? '3.' : '2.'} Text to generate with cloned voice</Label>
                    <Textarea
                      placeholder="Enter text for the cloned voice to speak..."
                      value={cloneText}
                      onChange={(e) => setCloneText(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={() => handleGenerate('voice_clone')}
                    disabled={isGenerating || !cloneText.trim() || (useMode === 'record' ? !recordingBlob : !selectedSavedVoice)}
                    className="w-full"
                    size="lg"
                  >
                    {isGenerating ? 'Cloning & Generating...' : 'Generate with Cloned Voice'}
                  </Button>

                  {currentAudio && (
                    <div className="space-y-2">
                      <audio key={currentAudio} controls autoPlay className="w-full">
                        <source src={currentAudio} type="audio/wav" />
                      </audio>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = currentAudio;
                          link.download = `qwen3-tts-clone-${Date.now()}.wav`;
                          link.click();
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Save Cloned Voice as WAV
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Voice Design Tab */}
            <TabsContent value="design" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="w-5 h-5" />
                    Voice Design
                  </CardTitle>
                  <CardDescription>Create a new voice from a text description</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Describe the voice you want</Label>
                    <Textarea
                      placeholder="e.g., A warm, friendly female voice with a slight British accent and gentle pacing..."
                      value={voiceDescription}
                      onChange={(e) => setVoiceDescription(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Text to speak</Label>
                    <Textarea
                      placeholder="Enter text for the designed voice to speak..."
                      value={designText}
                      onChange={(e) => setDesignText(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={() => handleGenerate('voice_design')}
                    disabled={isGenerating || !designText.trim() || !voiceDescription.trim()}
                    className="w-full"
                    size="lg"
                  >
                    {isGenerating ? 'Designing & Generating...' : 'Generate with Designed Voice'}
                  </Button>

                  {currentAudio && (
                    <div className="space-y-2">
                      <audio key={currentAudio} controls autoPlay className="w-full">
                        <source src={currentAudio} type="audio/wav" />
                      </audio>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = currentAudio;
                          link.download = `qwen3-tts-design-${Date.now()}.wav`;
                          link.click();
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Save Designed Voice as WAV
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Saved Voices Tab */}
            <TabsContent value="saved" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    My Saved Voices
                  </CardTitle>
                  <CardDescription>Manage your cloned voices for reuse</CardDescription>
                </CardHeader>
                <CardContent>
                  {savedVoices.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <User className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>No saved voices yet</p>
                      <p className="text-sm">Record a voice in the Voice Clone tab and save it</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {savedVoices.map((voice) => (
                        <Card key={voice.id} className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <h4 className="font-medium">{voice.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                Reference: {voice.referenceText || '(none)'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Created: {new Date(voice.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const audio = new Audio(voice.audioDataUrl);
                                  audio.play();
                                }}
                              >
                                <Play className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deleteVoice(voice.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Music className="w-5 h-5" />
                    Generated Audio History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {generatedAudios.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Music className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>No audio generated yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {generatedAudios.map((audio) => (
                        <Card key={audio.id} className="p-4">
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="px-2 py-1 bg-primary/10 text-primary rounded text-sm">
                                  {audio.mode.replace('_', ' ')}
                                </span>
                                {audio.speaker && (
                                  <span className="ml-2 text-sm text-muted-foreground">
                                    {audio.speaker}
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => setCurrentAudio(audio.audioUrl)}>
                                  <Play className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleDownload(audio)}>
                                  <Download className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleDelete(audio.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{audio.text}</p>
                            <p className="text-xs text-muted-foreground">
                              {audio.createdAt.toLocaleString('en-US')}
                            </p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          Powered by Qwen3-TTS via Replicate · Voice Cloning & Design
        </div>
      </footer>
    </div>
  );
}
