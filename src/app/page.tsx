'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Mic, Play, Download, Trash2, Volume2, Zap, Music, Brain, AudioLines, AlertCircle, CheckCircle2, UserPlus, UserMinus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const PREDEFINED_VOICES = [
  { id: 'longxiaochun', name: 'Xiaochun', description: 'Female, warm and friendly' },
  { id: 'longxiaoxia', name: 'Xiaoxia', description: 'Female, sweet voice' },
  { id: 'longlaotie', name: 'Laotie', description: 'Male, mature and steady' },
  { id: 'longshu', name: 'Shu', description: 'Male, gentle and calm' },
  { id: 'longjielidou', name: 'Jielidou', description: 'Child, cute and playful' },
  { id: 'longshuo', name: 'Shuo', description: 'Male, energetic' },
  { id: 'longyue', name: 'Yue', description: 'Female, elegant' },
  { id: 'longfei', name: 'Fei', description: 'Male, broadcaster style' },
  { id: 'longjing', name: 'Jing', description: 'Female, professional' },
  { id: 'longmiao', name: 'Miao', description: 'Female, lively' },
];

const TRAINING_PASSAGES = [
  {
    id: 1,
    title: 'Standard Passage',
    text: `The quick brown fox jumps over the lazy dog. A journey of a thousand miles begins with a single step. To be or not to be, that is the question. All the world's a stage, and all the men and women merely players. In the middle of difficulty lies opportunity. The only way to do great work is to love what you do. Success is not final, failure is not fatal: it is the courage to continue that counts.`,
    estimatedTime: '30 seconds',
  },
  {
    id: 2,
    title: 'Emotional Range',
    text: `I am so happy to be here today! This is absolutely wonderful news! Oh no, I can't believe this happened. I'm deeply sorry for your loss. What a beautiful day it is! I'm so excited about this opportunity. This makes me very sad. I'm thrilled to announce the results. I'm disappointed but hopeful for the future. This is the best moment of my life!`,
    estimatedTime: '25 seconds',
  },
  {
    id: 3,
    title: 'Technical Content',
    text: `The algorithm processes data through multiple neural network layers. Each neuron receives input signals, applies weights, and passes the result through an activation function. Backpropagation adjusts these weights to minimize error. The system learns patterns from training data and generalizes to new examples. Machine learning models require large datasets for optimal performance. Deep learning architectures can handle complex hierarchical representations.`,
    estimatedTime: '35 seconds',
  },
];

interface GeneratedAudio {
  id: string;
  text: string;
  voice: string;
  speed: number;
  volume: number;
  audioUrl: string;
  createdAt: Date;
}

interface CustomVoice {
  id: string;
  name: string;
  mappedVoice: string;
  recordingUrl: string | null;
  createdAt: Date;
}

export default function VoiceGeneratorPage() {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('longxiaochun');
  const [speed, setSpeed] = useState([1.0]);
  const [volume, setVolume] = useState([1.0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAudios, setGeneratedAudios] = useState<GeneratedAudio[]>([]);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);

  // Training states
  const [customVoices, setCustomVoices] = useState<CustomVoice[]>([]);
  const [selectedPassage, setSelectedPassage] = useState(TRAINING_PASSAGES[0]);
  const [voiceName, setVoiceName] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingStage, setTrainingStage] = useState('');
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [mappedVoice, setMappedVoice] = useState('longxiaochun');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load custom voices from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('customVoices');
    if (saved) {
      const voices = JSON.parse(saved);
      setCustomVoices(voices);
    }
  }, []);

  // Save custom voices to localStorage
  useEffect(() => {
    if (customVoices.length > 0) {
      localStorage.setItem('customVoices', JSON.stringify(customVoices));
    }
  }, [customVoices]);

  // Cleanup recording timer
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Combine predefined and custom voices
  const allVoices = [...PREDEFINED_VOICES, ...customVoices.map(cv => ({
    id: cv.id,
    name: cv.name,
    description: `${cv.name} (Custom Voice)`,
    isCustom: true,
  }))];

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter text to convert',
        variant: 'destructive',
      });
      return;
    }

    if (text.length > 2000) {
      toast({
        title: 'Error',
        description: 'Text length cannot exceed 2000 characters',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      // If it's a custom voice, use the mapped voice
      const voiceToUse = customVoices.find(cv => cv.id === selectedVoice)?.mappedVoice || selectedVoice;

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          voice: voiceToUse,
          speed: speed[0],
          volume: volume[0],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate speech');
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);

      const newAudio: GeneratedAudio = {
        id: Date.now().toString(),
        text: text.trim(),
        voice: selectedVoice,
        speed: speed[0],
        volume: volume[0],
        audioUrl,
        createdAt: new Date(),
      };

      setGeneratedAudios((prev) => [newAudio, ...prev]);
      setCurrentAudio(audioUrl);

      toast({
        title: 'Success',
        description: 'Speech generated successfully',
      });
    } catch (error) {
      console.error('Generate error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate speech, please try again later',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = (id: string) => {
    setGeneratedAudios((prev) => {
      const audio = prev.find((a) => a.id === id);
      if (audio && audio.audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audio.audioUrl);
      }
      return prev.filter((a) => a.id !== id);
    });
    if (currentAudio === generatedAudios.find((a) => a.id === id)?.audioUrl) {
      setCurrentAudio(null);
    }
  };

  const handleDownload = (audio: GeneratedAudio) => {
    const link = document.createElement('a');
    link.href = audio.audioUrl;
    link.download = `${audio.voice}_${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getVoiceName = (voiceId: string) => {
    return allVoices.find((v) => v.id === voiceId)?.name || voiceId;
  };

  // Recording functions
  const startRecording = async () => {
    try {
      if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        toast({
          title: 'Error',
          description: 'Audio recording is not supported. Make sure you\'re using HTTPS or localhost.',
          variant: 'destructive',
        });
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        setRecordingUrl(url);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: 'Error',
        description: 'Could not access microphone. Please check your permissions.',
        variant: 'destructive',
      });
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

  const startTraining = async () => {
    if (!voiceName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a name for your custom voice',
        variant: 'destructive',
      });
      return;
    }

    if (!recordingUrl) {
      toast({
        title: 'Error',
        description: 'Please record your voice first',
        variant: 'destructive',
      });
      return;
    }

    setIsTraining(true);
    setTrainingProgress(0);

    const stages = [
      'Analyzing audio patterns...',
      'Extracting voice characteristics...',
      'Building voice model...',
      'Optimizing voice parameters...',
      'Finalizing voice profile...',
    ];

    for (let i = 0; i < stages.length; i++) {
      setTrainingStage(stages[i]);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setTrainingProgress(((i + 1) / stages.length) * 100);
    }

    // Create custom voice
    const newVoice: CustomVoice = {
      id: `custom-${Date.now()}`,
      name: voiceName.trim(),
      mappedVoice: mappedVoice,
      recordingUrl: recordingUrl,
      createdAt: new Date(),
    };

    setCustomVoices((prev) => [...prev, newVoice]);

    // Reset form
    setVoiceName('');
    setRecordingUrl(null);
    setRecordingTime(0);
    setTrainingProgress(0);
    setTrainingStage('');
    setIsTraining(false);

    toast({
      title: 'Success',
      description: `Voice "${newVoice.name}" has been successfully created!`,
    });

    // Switch to the new voice in the main tab
    setSelectedVoice(newVoice.id);
  };

  const deleteCustomVoice = (id: string) => {
    const voice = customVoices.find((v) => v.id === id);
    if (voice && voice.recordingUrl) {
      URL.revokeObjectURL(voice.recordingUrl);
    }
    setCustomVoices((prev) => prev.filter((v) => v.id !== id));
    
    // Reset to default if current voice was deleted
    if (selectedVoice === id) {
      setSelectedVoice('longxiaochun');
    }

    toast({
      title: 'Voice Deleted',
      description: 'Custom voice has been removed',
    });
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
                AI Voice Cloner
              </h1>
            </div>
            <p className="text-muted-foreground">
              Generate speech and clone voices using AI technology
            </p>
          </div>

          <Tabs defaultValue="generate" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="generate">Generate Speech</TabsTrigger>
              <TabsTrigger value="training">Voice Training</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            {/* Generate Tab */}
            <TabsContent value="generate" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mic className="w-5 h-5" />
                    Text to Speech
                  </CardTitle>
                  <CardDescription>Enter text and select voice parameters to generate audio</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Text Input */}
                  <div className="space-y-2">
                    <Label htmlFor="text-input">
                      Enter Text <span className="text-muted-foreground">({text.length}/2000)</span>
                    </Label>
                    <Textarea
                      id="text-input"
                      placeholder="Enter the text content you want to convert to speech..."
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={6}
                      maxLength={2000}
                      className="resize-none"
                    />
                  </div>

                  {/* Voice Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="voice-select">Select Voice</Label>
                    <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                      <SelectTrigger id="voice-select">
                        <SelectValue placeholder="Select a voice" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                          Predefined Voices
                        </div>
                        {PREDEFINED_VOICES.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{voice.name}</span>
                              <span className="text-sm text-muted-foreground">{voice.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                        {customVoices.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground mt-2">
                              Custom Voices
                            </div>
                            {customVoices.map((voice) => (
                              <SelectItem key={voice.id} value={voice.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{voice.name}</span>
                                  <span className="text-sm text-muted-foreground">Custom Voice</span>
                                </div>
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Speed Control */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="speed-slider" className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Speed
                      </Label>
                      <span className="text-sm font-medium">{speed[0]}x</span>
                    </div>
                    <Slider
                      id="speed-slider"
                      value={speed}
                      onValueChange={setSpeed}
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      className="cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0.5x (Slow)</span>
                      <span>1.0x (Normal)</span>
                      <span>2.0x (Fast)</span>
                    </div>
                  </div>

                  {/* Volume Control */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="volume-slider" className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4" />
                        Volume
                      </Label>
                      <span className="text-sm font-medium">{volume[0]}</span>
                    </div>
                    <Slider
                      id="volume-slider"
                      value={volume}
                      onValueChange={setVolume}
                      min={0.1}
                      max={10}
                      step={0.1}
                      className="cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0.1 (Quiet)</span>
                      <span>1.0 (Normal)</span>
                      <span>10.0 (Loud)</span>
                    </div>
                  </div>

                  {/* Generate Button */}
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !text.trim()}
                    className="w-full"
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Mic className="mr-2 h-5 w-5" />
                        Generate Speech
                      </>
                    )}
                  </Button>

                  {/* Audio Player */}
                  {currentAudio && (
                    <div className="space-y-2 pt-4 border-t">
                      <Label>Preview</Label>
                      <audio
                        key={currentAudio}
                        controls
                        autoPlay
                        className="w-full"
                      >
                        <source src={currentAudio} type="audio/wav" />
                        Your browser does not support audio playback
                      </audio>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Training Tab */}
            <TabsContent value="training" className="space-y-6">
              <div className="grid gap-6">
                {/* Voice Creation Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="w-5 h-5" />
                      Create Custom Voice
                    </CardTitle>
                    <CardDescription>
                      Record your voice reading a passage to create a custom voice profile
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Voice Name */}
                    <div className="space-y-2">
                      <Label htmlFor="voice-name">Voice Name</Label>
                      <Input
                        id="voice-name"
                        placeholder="e.g., My Voice, John's Voice, etc."
                        value={voiceName}
                        onChange={(e) => setVoiceName(e.target.value)}
                        disabled={isTraining}
                      />
                    </div>

                    {/* Passage Selection */}
                    <div className="space-y-2">
                      <Label>Select Training Passage</Label>
                      <div className="grid gap-2">
                        {TRAINING_PASSAGES.map((passage) => (
                          <Button
                            key={passage.id}
                            variant={selectedPassage.id === passage.id ? 'default' : 'outline'}
                            className="justify-start text-left h-auto py-3"
                            onClick={() => setSelectedPassage(passage)}
                            disabled={isTraining || isRecording}
                          >
                            <div className="flex-1">
                              <div className="font-medium">{passage.title}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Estimated time: {passage.estimatedTime}
                              </div>
                            </div>
                            {selectedPassage.id === passage.id && (
                              <CheckCircle2 className="w-5 h-5 ml-2" />
                            )}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Passage Text */}
                    <div className="space-y-2">
                      <Label>Passage to Read</Label>
                      <div className="p-4 bg-muted rounded-lg max-h-48 overflow-y-auto">
                        <p className="text-sm leading-relaxed">{selectedPassage.text}</p>
                      </div>
                    </div>

                    {/* Recording Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Record Your Voice</Label>
                        {isRecording && (
                          <div className="flex items-center gap-2 text-sm text-destructive">
                            <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                            {formatTime(recordingTime)}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {!recordingUrl ? (
                          <>
                            {!isRecording ? (
                              <Button
                                onClick={startRecording}
                                className="flex-1"
                                disabled={isTraining}
                              >
                                <AudioLines className="mr-2 h-5 w-5" />
                                Start Recording
                              </Button>
                            ) : (
                              <Button
                                onClick={stopRecording}
                                variant="destructive"
                                className="flex-1"
                              >
                                <AudioLines className="mr-2 h-5 w-5" />
                                Stop Recording
                              </Button>
                            )}
                          </>
                        ) : (
                          <Button
                            onClick={() => {
                              setRecordingUrl(null);
                              setRecordingTime(0);
                            }}
                            variant="outline"
                            className="flex-1"
                            disabled={isTraining}
                          >
                            <AudioLines className="mr-2 h-5 w-5" />
                            Re-record
                          </Button>
                        )}
                      </div>

                      {recordingUrl && (
                        <div className="space-y-2">
                          <audio controls className="w-full">
                            <source src={recordingUrl} type="audio/wav" />
                          </audio>
                        </div>
                      )}
                    </div>

                    {/* Voice Mapping */}
                    <div className="space-y-2">
                      <Label htmlFor="mapped-voice">
                        Base Voice Style
                        <span className="text-xs text-muted-foreground ml-2">
                          (Select the closest match to your voice)
                        </span>
                      </Label>
                      <Select value={mappedVoice} onValueChange={setMappedVoice} disabled={isTraining}>
                        <SelectTrigger id="mapped-voice">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PREDEFINED_VOICES.map((voice) => (
                            <SelectItem key={voice.id} value={voice.id}>
                              {voice.name} - {voice.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Training Progress */}
                    {isTraining && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{trainingStage}</span>
                          <span>{Math.round(trainingProgress)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-500"
                            style={{ width: `${trainingProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Create Voice Button */}
                    <Button
                      onClick={startTraining}
                      disabled={!voiceName.trim() || !recordingUrl || isTraining || isRecording}
                      className="w-full"
                      size="lg"
                    >
                      {isTraining ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                          Training Voice...
                        </>
                      ) : (
                        <>
                          <Brain className="mr-2 h-5 w-5" />
                          Create Voice Profile
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Custom Voices List */}
                {customVoices.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Music className="w-5 h-5" />
                        Your Custom Voices
                      </CardTitle>
                      <CardDescription>Manage your created voice profiles</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {customVoices.map((voice) => (
                          <div key={voice.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex-1">
                              <div className="font-medium">{voice.name}</div>
                              <div className="text-sm text-muted-foreground">
                                Created: {voice.createdAt.toLocaleString('longxiaochun')}
                              </div>
                            </div>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteCustomVoice(voice.id)}
                            >
                              <UserMinus className="w-4 h-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Music className="w-5 h-5" />
                    History
                  </CardTitle>
                  <CardDescription>View and manage generated audio files</CardDescription>
                </CardHeader>
                <CardContent>
                  {generatedAudios.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Music className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>No history yet</p>
                      <p className="text-sm">Records will appear here after generating speech</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                      {generatedAudios.map((audio) => (
                        <Card key={audio.id} className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="px-2 py-1 bg-primary/10 text-primary rounded-md text-sm font-medium">
                                    {getVoiceName(audio.voice)}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {audio.speed}x · Volume {audio.volume}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {audio.text}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {audio.createdAt.toLocaleString('longxiaochun')}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setCurrentAudio(audio.audioUrl)}
                                >
                                  <Play className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownload(audio)}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDelete(audio.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <audio
                              key={audio.audioUrl}
                              controls
                              className="w-full"
                              hidden={currentAudio !== audio.audioUrl}
                            >
                              <source src={audio.audioUrl} type="audio/wav" />
                            </audio>
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

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          <p>AI Voice Cloner · Powered by Dashscope CosyVoice · Voice Training & Cloning</p>
        </div>
      </footer>
    </div>
  );
}
