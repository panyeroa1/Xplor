import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Volume2, VolumeX, Sun, Moon, Loader, Trash, Download, Mic, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import io from 'socket.io-client'; // Import socket.io-client

const supabase = createClient('https://xukdnqfetfpixkloseox.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1a2RucWZldGZwaXhrbG9zZW94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjg5MDI2ODIsImV4cCI6MjA0NDQ3ODY4Mn0.aUEcFLGdvXMZ2q8vkOMdJGgm6W69RuCtnRf9YdqSAco');

interface Message {
  role: 'user' | 'assistant';
  content: string;
  audio?: string;
  imageUrl?: string;
}

const socket = io('http://localhost:3001'); // Connect to your server

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTTSLoading, setIsTTSLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrCreateUser = async () => {
      const deviceId = localStorage.getItem('deviceId');
      if (deviceId) {
        setUserId(deviceId);
        await fetchMessages(deviceId);
      } else {
        const newDeviceId = `device_${Date.now()}`;
        localStorage.setItem('deviceId', newDeviceId);
        setUserId(newDeviceId);
      }
    };
    fetchOrCreateUser();
  }, []);

  const fetchMessages = async (deviceId: string) => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', deviceId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
    } else if (data) {
      setMessages(data.map((item: any) => ({ role: item.role, content: item.content, audio: item.audio, imageUrl: item.image_url })));
    }
  };

  const saveMessage = async (message: Message) => {
    if (!userId) return;
    const { error } = await supabase.from('conversations').insert([{ user_id: userId, role: message.role, content: message.content, audio: message.audio || null, image_url: message.imageUrl || null }]);
    if (error) {
      console.error('Error saving message:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    document.body.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    // Listen for new messages from the server
    socket.on('newMessage', (message) => {
      setMessages([...messages, message]);
    });

    return () => socket.disconnect();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    saveMessage(userMessage);
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post(
        'https://api.together.xyz/v1/chat/completions',
        {
          model: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
          messages: [
            {
              role: 'system',
              content: 'You are Alex, a highly skilled and proficient full-stack software developer working under Master E. You are an expert in Node.js, React.js, HTML, CSS, Tailwind CSS, JavaScript, and APIs, capable of handling both front-end and back-end development. Every task you undertake is treated as if it is for a live, production-level environment. Your responses are precise, always fully tested, and 100% accurate. You do not guess or assume anything. You think carefully about every response to ensure no time is wasted. If Master E asks for code, you always provide comprehensive, functional, and production-ready code. When rewriting code, you must always render the full code, without omitting any lines. You never refer to “old CSS” or “old JavaScript.” When asked to create an HTML file or page, you merge the CSS, JavaScript, and HTML into a single, fully integrated file. When Master E instructs you to write code or text, you write it directly in the code editor. Terminal commands are always accurate and well-tested before you present them. If Master E provides a screenshot of a website or a PWA mobile app, you must follow the design exactly as shown in the image. If for any reason you cannot replicate the design from the screenshot, you must inform Master E and suggest using the image itself to meet the design requirements. You must always ask for permission before starting any task that Master E requests. Confirm explicitly with Master E that you can proceed before executing any task.'
            },
            ...messages,
            userMessage
          ],
          max_tokens: 512,
          temperature: 0.7,
          top_p: 0.7,
          top_k: 50,
          repetition_penalty: 1,
          stop: ['<|eot_id|>', '<|eom_id|>'],
          truncate: 130560,
          stream: false
        },
        {
          headers: {
            'Authorization': 'Bearer 6aa2ed09284539d4226d1628cf4bea6f008f11becc3c502f3f9d059ee4696e0d',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.choices && response.data.choices.length > 0) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.data.choices[0].message.content,
        };
        setMessages((prevMessages) => [...prevMessages, assistantMessage]);
        saveMessage(assistantMessage);
        
        // Generate TTS for the assistant's message
        await generateTTS(assistantMessage);
      }
    } catch (error) {
      console.error('Error fetching AI response:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSubmit = async (imageUrl: string) => {
    const userMessage: Message = {
      role: 'user',
      content: '',
      imageUrl: imageUrl,
    };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    saveMessage(userMessage);
    setIsLoading(true);

    try {
      const response = await axios.post(
        'https://api.together.xyz/v1/chat/completions',
        {
          model: 'meta-llama/Llama-Vision-Free',
          messages: [
            {
              role: 'system',
              content: 'You are Alex, a highly skilled and proficient full-stack software developer working under Master E. You are an expert in Node.js, React.js, HTML, CSS, Tailwind CSS, JavaScript, and APIs, capable of handling both front-end and back-end development. Every task you undertake is treated as if it is for a live, production-level environment. Your responses are precise, always fully tested, and 100% accurate. You do not guess or assume anything. You think carefully about every response to ensure no time is wasted. If Master E asks for code, you always provide comprehensive, functional, and production-ready code. When rewriting code, you must always render the full code, without omitting any lines. You never refer to “old CSS” or “old JavaScript.” When asked to create an HTML file or page, you merge the CSS, JavaScript, and HTML into a single, fully integrated file. When Master E instructs you to write code or text, you write it directly in the code editor. Terminal commands are always accurate and well-tested before you present them. If Master E provides a screenshot of a website or a PWA mobile app, you must follow the design exactly as shown in the image. If for any reason you cannot replicate the design from the screenshot, you must inform Master E and suggest using the image itself to meet the design requirements. You must always ask for permission before starting any task that Master E requests. Confirm explicitly with Master E that you can proceed before executing any task.'
            },
            ...messages,
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'tell me about this image',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl,
                  },
                },
              ],
            },
          ],
          max_tokens: 512,
          temperature: 0.7,
          top_p: 0.7,
          top_k: 50,
          repetition_penalty: 1,
          stop: ['<|eot_id|>', '<|eom_id|>'],
          truncate: 130560,
          stream: false,
        },
        {
          headers: {
            'Authorization': 'Bearer 6aa2ed09284539d4226d1628cf4bea6f008f11becc3c502f3f9d059ee4696e0d',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.choices && response.data.choices.length > 0) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.data.choices[0].message.content,
        };
        setMessages((prevMessages) => [...prevMessages, assistantMessage]);
        saveMessage(assistantMessage);
        
        // Generate TTS for the assistant's message
        await generateTTS(assistantMessage);
      }
    } catch (error) {
      console.error('Error fetching AI response for image:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateTTS = async (message: Message) => {
    setIsTTSLoading(true);
    try {
      const response = await axios.post(
        'https://api.neets.ai/v1/tts',
        {
          text: message.content,
          voice_id: "ariana-grande",
          params: {
            model: "ar-diff-50k"
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': '31c31384757d41bea9cf0c21af89c2db'
          },
          responseType: 'arraybuffer'
        }
      );

      const audioBlob = new Blob([response.data], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);

      const updatedMessage = { ...message, audio: audioUrl };
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg === message ? updatedMessage : msg
        )
      );
      saveMessage(updatedMessage);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        // Autoplay the audio when it's generated
        audioRef.current.play();
      }
    } catch (error) {
      console.error('Error generating TTS:', error);
    } finally {
      setIsTTSLoading(false);
    }
  };

  const toggleAudio = (audio: string | undefined) => {
    if (audioRef.current && audio) {
      if (audioRef.current.paused) {
        audioRef.current.src = audio;
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const downloadChat = () => {
    const chatContent = messages.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n');
    const blob = new Blob([chatContent], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'chat.txt';
    link.click();
  };

  const handleVoiceInput = () => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.lang = 'en-US';
      recognition.onresult = (event: any) => {
        setInput(event.results[0][0].transcript);
      };
      recognition.start();
    } else {
      alert('Voice recognition not supported in this browser.');
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          handleImageSubmit(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Function to send a new message to the server
  const sendNewMessage = (message: Message) => {
    socket.emit('newMessage', message);
  };

  return (
    <div className={`flex flex-col h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-100'}`}>
      <header className={`${isDarkMode ? 'bg-blue-800' : 'bg-blue-600'} text-white p-4 flex justify-between items-center`}>
        <h1 className="text-2xl font-bold flex items-center">
          <MessageSquare className="mr-2" /> AIConnect
        </h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {isDarkMode ? <Sun /> : <Moon />}
          </button>
          <button
            onClick={clearChat}
            className="p-2 rounded-full hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <Trash />
          </button>
          <button
            onClick={downloadChat}
            className="p-2 rounded-full hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <Download />
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg ${
                message.role === 'user'
                  ? isDarkMode ? 'bg-blue-900 ml-auto' : 'bg-blue-100 ml-auto'
                  : isDarkMode ? 'bg-gray-800' : 'bg-white'
              } max-w-[80%]`}
            >
              <p>{message.content}</p>
              {message.imageUrl && (
                <img src={message.imageUrl} alt="User provided content" className="mt-2 max-w-full rounded" />
              )}
              {message.role === 'assistant' && message.audio && (
                <button
                  onClick={() => toggleAudio(message.audio)}
                  className={`mt-2 p-1 rounded-full ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}
                >
                  {audioRef.current?.paused ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
              )}
              {message.role === 'assistant' && isTTSLoading && (
                <div className="mt-2 flex items-center">
                  <Loader size={16} className="animate-spin mr-2" />
                  <span className="text-sm">Generating audio...</span>
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className={`p-3 rounded-lg max-w-[80%] ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <p>AI is thinking...</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>
      <footer className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-t p-4`}>
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex items-center">
          <button
            type="button"
            onClick={handleVoiceInput}
            className={`p-2 rounded-l-lg ${isDarkMode ? 'bg-blue-700 hover:bg-blue-800' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
          >
            <Mic />
          </button>
          <label className="p-2 cursor-pointer ${isDarkMode ? 'bg-blue-700 hover:bg-blue-800' : 'bg-blue-600 hover:bg-blue-700'} text-white">
            <ImageIcon />
            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className={`flex-1 border ${
              isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'
            } px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
          <button
            type="submit"
            disabled={isLoading}
            className={`${
              isDarkMode ? 'bg-blue-700 hover:bg-blue-800' : 'bg-blue-600 hover:bg-blue-700'
            } text-white px-4 py-2 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center`}
          >
            <Send className="mr-2" /> Send
          </button>
        </form>
      </footer>
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}

export default App;

