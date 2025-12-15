"use client";

import React, { useState, useEffect, useRef } from "react";

interface TextMessage {
  id?: string; // UUID for tracking this donation
  type: string;
  donorName?: string;
  amount?: number;
  message?: string;
  duration?: number; // Display duration in milliseconds (from backend)
  visible?: boolean;
}

// TTS function - Browser built-in with high quality, clear, and slow
function speak(text: string) {
  if (!("speechSynthesis" in window)) {
    console.warn("Speech synthesis not supported");
    return;
  }

  const speakWithVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    
    if (voices.length === 0) {
      console.warn("No voices available, retrying...");
      // Retry after a short delay
      setTimeout(() => {
        const retryVoices = window.speechSynthesis.getVoices();
        if (retryVoices.length > 0) {
          speakWithVoice();
        }
      }, 500);
      return;
    }

    // Prioritaskan voice Indonesia yang bagus dan jernih
    // Cari Google Indonesia terlebih dahulu (paling jernih)
    const googleIdVoice = voices.find(
      v => v.lang === "id-ID" && v.name.toLowerCase().includes("google")
    );

    // Fallback ke voice Indonesia lainnya
    const idVoice = voices.find(v => v.lang === "id-ID");

    // Pilih voice terbaik
    const voice = googleIdVoice || idVoice || voices.find(v => v.lang.startsWith("id")) || voices[0];

    if (!voice) {
      console.warn("No suitable voice found, using default");
      // Use default voice if no Indonesian voice found
      const defaultVoice = voices[0];
      if (!defaultVoice) return;
    }

    // Bersihkan text untuk TTS
    const cleanText = text
      .replace(/Rp/g, "Rupiah ")
      .replace(/(\d+)/g, (match) => {
        // Format angka dengan lebih jelas
        const num = parseInt(match);
        if (num >= 1000000) {
          return `${Math.floor(num / 1000000)} juta`;
        } else if (num >= 1000) {
          return `${Math.floor(num / 1000)} ribu`;
        }
        return match;
      });

    // Pecah menjadi kalimat untuk jeda natural
    const sentences = cleanText
      .split(/([.!?])/)
      .reduce<string[]>((acc, cur) => {
        if (!cur.trim()) return acc;
        if (/[.!?]/.test(cur)) {
          if (acc.length > 0) {
            acc[acc.length - 1] += cur;
          } else {
            acc.push(cur.trim());
          }
        } else {
          acc.push(cur.trim());
        }
        return acc;
      }, [])
      .filter(s => s.trim().length > 0);

    if (sentences.length === 0) {
      console.warn("No sentences to speak");
      return;
    }

    // Hentikan suara sebelumnya
    window.speechSynthesis.cancel();

    // Ucapkan setiap kalimat dengan jeda
    sentences.forEach((sentence, index) => {
      const utterance = new SpeechSynthesisUtterance(sentence);

      utterance.voice = voice || null;
      utterance.lang = voice?.lang || "id-ID";
      
      // Pengaturan untuk suara jernih dan slow
      utterance.rate = 0.75;      // Slow (0.1 - 10, default 1)
      utterance.pitch = 1.0;      // Normal pitch (0 - 2, default 1)
      utterance.volume = 1.0;     // Full volume (0 - 1, default 1)

      // Error handling
      utterance.onerror = (event) => {
        console.error("TTS error:", event.error);
      };

      utterance.onstart = () => {
        console.log("TTS started:", sentence);
      };

      utterance.onend = () => {
        console.log("TTS ended:", sentence);
      };

      // Jeda antar kalimat
      if (index > 0) {
        // Add small delay between sentences
        setTimeout(() => {
          window.speechSynthesis.speak(utterance);
        }, index * 300);
      } else {
        window.speechSynthesis.speak(utterance);
      }
    });
  };

  // Tunggu voices loaded jika belum ready
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    // Wait for voices to load
    const checkVoices = () => {
      const loadedVoices = window.speechSynthesis.getVoices();
      if (loadedVoices.length > 0) {
        speakWithVoice();
      } else {
        setTimeout(checkVoices, 100);
      }
    };
    window.speechSynthesis.onvoiceschanged = checkVoices;
    // Also try after a delay
    setTimeout(checkVoices, 500);
  } else {
    speakWithVoice();
  }
}

// Helper function to calculate TTS duration based on text length
// Rate 0.75 means slower speech, approximately 100-150 words per minute
// Average: ~2 characters per word, so ~150-225 characters per minute
// Using conservative estimate: ~200 characters per minute = ~3.3 chars per second
function calculateTTSDuration(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }
  
  // Rate 0.75 means 75% of normal speed
  // Normal speed: ~150 words/min = ~300 chars/min = ~5 chars/sec
  // At 0.75 rate: ~3.75 chars/sec
  // Add buffer for pauses between sentences
  const charsPerSecond = 3.5; // Conservative estimate for rate 0.75
  const baseDuration = (text.length / charsPerSecond) * 1000; // Convert to milliseconds
  
  // Add extra time for pauses (300ms per sentence break)
  const sentenceBreaks = (text.match(/[.!?]/g) || []).length;
  const pauseTime = sentenceBreaks * 300;
  
  // Minimum 2 seconds for very short text
  return Math.max(2000, baseDuration + pauseTime);
}

// Helper function to calculate display duration based on donation amount
// 1000 = 10 detik, setiap kelipatan 1000 = +10 detik
function calculateDisplayDuration(amount: number): number {
  if (isNaN(amount) || amount <= 0) {
    return 10000; // Default 10 seconds if invalid
  }
  
  // Calculate: amount / 1000 * 10 seconds (in milliseconds)
  // 1000 = 10 detik, 2000 = 20 detik, etc.
  const durationMs = (amount / 1000) * 10 * 1000;
  
  // Minimum 10 seconds
  return Math.max(10000, durationMs);
}

export default function TextPage() {
  const [textMessage, setTextMessage] = useState<{
    id: string; // UUID for tracking
    donorName: string;
    amount: number;
    message?: string;
  } | null>(null);
  const [currentDonationId, setCurrentDonationId] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pauseStartTimeRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsStopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      let wsHost = process.env.NEXT_PUBLIC_WS_HOST || "localhost:5000";
      // Remove protocol if present (http:// or https://)
      wsHost = wsHost.replace(/^https?:\/\//, "");
      const wsUrl = `${wsProtocol}//${wsHost}/ws`;

      try {
        // Close existing connection if any
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log("🔄 Closing existing WebSocket connection before reconnecting");
          wsRef.current.close();
        }

        const ws = new WebSocket(wsUrl);
        console.log("🔌 Attempting WebSocket connection to:", wsUrl);

        ws.onopen = () => {
          console.log("✅ WebSocket connected successfully");
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            // Handle single message or multiple messages separated by newline
            const rawData = event.data.toString().trim();
            if (!rawData) return;

            const messages = rawData.includes('\n') 
              ? rawData.split('\n').filter((msg: string) => msg.trim())
              : [rawData];
            
            for (const message of messages) {
              const trimmed = message.trim();
              if (!trimmed) continue;
              
              try {
                const data: TextMessage = JSON.parse(trimmed);

                if (data.type === "text" && data.donorName && data.amount !== undefined && data.amount > 0 && data.id) {
                  // Validate message max 250 characters (only for text donations)
                  // Handle undefined, null, or empty string
                  let message = data.message || "";
                  if (typeof message === "string" && message.length > 250) {
                    message = message.substring(0, 250);
                  }
                  
                  // Calculate TTS duration based on text length
                  const ttsText = `${data.donorName} baru saja memberikan Rp${data.amount.toLocaleString("id-ID")}${message ? `. ${message}` : ""}`;
                  const ttsDuration = calculateTTSDuration(ttsText);
                  
                  // Use duration from backend, fallback to calculated if not provided
                  const amountBasedDuration = data.duration || calculateDisplayDuration(data.amount);
                  
                  // Text display duration: always 10 seconds (text will disappear after 10 seconds)
                  // BGM plays for 2 seconds, then TTS starts
                  // Text disappears after 10 seconds regardless of TTS duration
                  const finalDuration = 10000; // Always 10 seconds for text display
                  
                  console.log("📥 Received text donation:", {
                    id: data.id,
                    donorName: data.donorName,
                    amount: data.amount,
                    message: message,
                    messageLength: message ? message.length : 0,
                    durationFromBackend: data.duration,
                    amountBasedDuration,
                    ttsDuration,
                    ttsTextLength: ttsText.length,
                    finalDuration,
                  });
                  
                  // Set duration FIRST before setting text message
                  // This ensures useEffect has the correct duration when it runs
                  setTotalDuration(finalDuration);
                  setRemainingTime(finalDuration);
                  
                  setTextMessage({
                    id: data.id,
                    donorName: data.donorName,
                    amount: data.amount,
                    message: message, // Always set message, even if empty string
                  });
                  setCurrentDonationId(data.id);
                  setIsVisible(true);
                  pauseStartTimeRef.current = null;

                  // Play BGM first for 2 seconds, then TTS will start
                  if (audioRef.current) {
                    console.log("🎵 Attempting to play BGM for 2 seconds...");
                    audioRef.current.currentTime = 0; // Reset to start
                    
                    // Check if audio is ready
                    if (audioRef.current.readyState >= 2) { // HAVE_CURRENT_DATA or higher
                      audioRef.current.play()
                        .then(() => {
                          console.log("✅ BGM playing successfully");
                          
                          // Stop BGM after 2 seconds
                          setTimeout(() => {
                            if (audioRef.current) {
                              audioRef.current.pause();
                              audioRef.current.currentTime = 0;
                              console.log("🛑 BGM stopped after 2 seconds");
                            }
                          }, 2000);
                        })
                        .catch((err) => {
                          console.error("❌ Failed to play BGM:", err);
                          console.error("Error details:", {
                            name: err.name,
                            message: err.message,
                            readyState: audioRef.current?.readyState,
                            networkState: audioRef.current?.networkState,
                          });
                          
                          // Try to load again if failed
                          if (audioRef.current) {
                            audioRef.current.load();
                            setTimeout(() => {
                              if (audioRef.current) {
                                audioRef.current.play()
                                  .then(() => {
                                    // Stop BGM after 2 seconds
                                    setTimeout(() => {
                                      if (audioRef.current) {
                                        audioRef.current.pause();
                                        audioRef.current.currentTime = 0;
                                        console.log("🛑 BGM stopped after 2 seconds");
                                      }
                                    }, 2000);
                                  })
                                  .catch((retryErr) => {
                                    console.error("❌ Retry play also failed:", retryErr);
                                  });
                              }
                            }, 100);
                          }
                        });
                    } else {
                      console.warn("⚠️ Audio not ready yet, readyState:", audioRef.current.readyState);
                      // Wait for audio to be ready
                      const onCanPlay = () => {
                        if (audioRef.current) {
                          audioRef.current.play()
                            .then(() => {
                              // Stop BGM after 2 seconds
                              setTimeout(() => {
                                if (audioRef.current) {
                                  audioRef.current.pause();
                                  audioRef.current.currentTime = 0;
                                  console.log("🛑 BGM stopped after 2 seconds");
                                }
                              }, 2000);
                            })
                            .catch((err) => {
                              console.error("❌ Failed to play BGM after ready:", err);
                            });
                          audioRef.current.removeEventListener("canplay", onCanPlay);
                        }
                      };
                      audioRef.current.addEventListener("canplay", onCanPlay);
                    }
                  } else {
                    console.error("❌ audioRef.current is null!");
                  }

                  // TTS: Speak the donation message AFTER BGM starts (2 seconds delay)
                  // TTS will only speak once (no looping)
                  // TTS will be stopped after 10 seconds total (8 seconds after TTS starts)
                  setTimeout(() => {
                    console.log("🎤 Starting TTS after BGM (2 seconds delay):", ttsText);
                    speak(ttsText);
                    
                    // Stop TTS after 10 seconds total (8 seconds after TTS starts)
                    ttsStopTimeoutRef.current = setTimeout(() => {
                      console.log("🛑 Stopping TTS after 10 seconds total");
                      window.speechSynthesis.cancel();
                      ttsStopTimeoutRef.current = null;
                    }, 8000); // 8 seconds after TTS starts = 10 seconds total
                  }, 2000); // Wait 2 seconds for BGM to start
                }

                if (data.type === "visibility") {
                  // Handle visibility for current donation
                  if (data.id && data.id === currentDonationId) {
                    setIsVisible(data.visible ?? true);
                    if (data.visible) {
                      // Resumed - adjust remaining time if was paused
                      if (pauseStartTimeRef.current !== null) {
                        const pauseDuration = Date.now() - pauseStartTimeRef.current;
                        setRemainingTime((prev) => prev + pauseDuration);
                        pauseStartTimeRef.current = null;
                      }
                      // Resume BGM
                      if (audioRef.current) {
                        audioRef.current.play().catch((err) => {
                          console.warn("Failed to resume BGM:", err);
                        });
                      }
                    } else {
                      // Paused - record pause start time
                      pauseStartTimeRef.current = Date.now();
                      // Pause BGM
                      if (audioRef.current) {
                        audioRef.current.pause();
                      }
                    }
                  }
                }
              } catch {
                // Skip invalid JSON messages
                console.warn("Invalid JSON message:", trimmed.substring(0, 100));
              }
            }
          } catch (error) {
            console.error("Error processing WebSocket message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("❌ WebSocket error:", error);
          // Try to reconnect immediately on error
          if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
            if (!reconnectTimeoutRef.current) {
              reconnectTimeoutRef.current = setTimeout(() => {
                console.log("🔄 Reconnecting WebSocket after error...");
                connectWebSocket();
              }, 1000);
            }
          }
        };

        ws.onclose = (event) => {
          console.log("🔌 WebSocket closed:", {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });
          
          // Only reconnect if not manually closed
          if (event.code !== 1000) {
            if (!reconnectTimeoutRef.current) {
              console.log("🔄 Scheduling WebSocket reconnection in 3 seconds...");
              reconnectTimeoutRef.current = setTimeout(() => {
                connectWebSocket();
              }, 3000);
            }
          }
        };

        wsRef.current = ws;
      } catch (error) {
        console.error("❌ WebSocket connection failed:", error);
        // Retry connection after 3 seconds
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("🔄 Retrying WebSocket connection...");
            connectWebSocket();
          }, 3000);
        }
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio("/bgm.mp3");
      audio.loop = false; // Play once, no looping
      audio.preload = "auto";
      
      // Set volume (some browsers require this for autoplay)
      audio.volume = 1.0;
      
      // Add error handling
      audio.addEventListener("error", (e) => {
        console.error("❌ Audio error:", e);
        console.error("Audio error details:", {
          code: audio.error?.code,
          message: audio.error?.message,
          src: audio.src,
        });
      });
      
      audio.addEventListener("loadeddata", () => {
        console.log("✅ BGM audio loaded successfully");
      });
      
      audio.addEventListener("canplay", () => {
        console.log("✅ BGM audio ready to play");
      });
      
      audio.addEventListener("loadstart", () => {
        console.log("🔄 BGM audio loading started");
      });
      
      // Try to preload by loading the audio (this helps with autoplay policy)
      try {
        audio.load();
      } catch (err) {
        console.warn("⚠️ Audio preload warning:", err);
      }
      
      audioRef.current = audio;
      console.log("🎵 BGM audio initialized:", audio.src);
    }

    return () => {
      // Cleanup audio on unmount
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Auto-hide based on donation duration from backend
  useEffect(() => {
    if (!textMessage) {
      // Clean up when no text message
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setTimeout(() => {
        setRemainingTime(0);
        setTotalDuration(0);
      }, 0);
      return;
    }

    // Get duration from state or calculate fallback
    // Duration should already be set from websocket handler, but use fallback if not
    const currentDuration = totalDuration > 0 ? totalDuration : calculateDisplayDuration(textMessage.amount);
    
    console.log("⏱️ Timer setup:", {
      donationId: textMessage.id,
      amount: textMessage.amount,
      totalDuration,
      calculatedDuration: calculateDisplayDuration(textMessage.amount),
      currentDuration,
    });

    // Update progress bar every second (only when visible)
    progressIntervalRef.current = setInterval(() => {
      if (!isVisible) {
        // Don't count down when paused
        return;
      }
      
      setRemainingTime((prev) => {
        const newTime = Math.max(0, prev - 1000);
        if (newTime <= 0) {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
          // Close when time is up
          setTextMessage(null);
          setCurrentDonationId(null);
          setRemainingTime(0);
          setTotalDuration(0);
          setIsVisible(true);
          pauseStartTimeRef.current = null;
          // Stop BGM
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          // Stop TTS
          window.speechSynthesis.cancel();
          if (ttsStopTimeoutRef.current) {
            clearTimeout(ttsStopTimeoutRef.current);
            ttsStopTimeoutRef.current = null;
          }
        }
        return newTime;
      });
    }, 1000);

    // Use currentDuration for timer
    const timer = setTimeout(() => {
      setTextMessage(null);
      setCurrentDonationId(null);
      setRemainingTime(0);
      setTotalDuration(0);
      setIsVisible(true);
      pauseStartTimeRef.current = null;
      // Stop BGM
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      // Stop TTS
      window.speechSynthesis.cancel();
      if (ttsStopTimeoutRef.current) {
        clearTimeout(ttsStopTimeoutRef.current);
        ttsStopTimeoutRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }, currentDuration);

    return () => {
      clearTimeout(timer);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [textMessage, isVisible, totalDuration]);

  // Helper function to format time as MM:SS
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Calculate progress percentage
  const progressPercentage = totalDuration > 0 
    ? ((totalDuration - remainingTime) / totalDuration) * 100 
    : 0;

  // Completely hidden when no content or when paused
  if (!textMessage) {
    return <div className="hidden" />;
  }

  if (!isVisible) {
    return <div className="hidden" />;
  }

  return (
    <div className="flex flex-col w-full h-auto bg-black">
      {/* Progress Bar - YouTube style */}
      {textMessage && totalDuration > 0 && (
        <div className="h-1 shrink-0 bg-gray-800 relative cursor-pointer group">
          {/* Progress line */}
          <div 
            className="h-full bg-red-600 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercentage}%` }}
          />
          {/* Time display on hover */}
          <div className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {formatTime(remainingTime)} / {formatTime(totalDuration)}
          </div>
          {/* Current time indicator */}
          <div className="absolute top-0 left-0 h-full w-0.5 bg-white opacity-0 group-hover:opacity-100 transition-opacity" 
               style={{ left: `${progressPercentage}%` }} />
        </div>
      )}

      {/* Text Message - Auto height based on content */}
      {textMessage && (
        <div className="w-full shrink-0 animate-[slideUp_0.5s_ease-out] mt-4">
          <div className="bg-black/80 backdrop-blur-sm px-4 py-2 shadow-2xl rounded-lg">
            <div className="flex flex-col items-center text-center">
              {/* Line 1: Donor name and amount */}
              <div className="text-white text-[30px] font-semibold break-words px-2" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                <span className="text-[#FFB703]">
                  {textMessage.donorName}
                </span>{" "}
                baru saja memberikan{" "}
                <span className="text-[#FFB703]">
                  Rp{textMessage.amount.toLocaleString("id-ID")}
                </span>
              </div>

              {/* Line 2: Optional message - moved down */}
              {textMessage.message && textMessage.message.trim().length > 0 && (
                <div className="text-zinc-300 text-[30px] mt-2 break-words max-w-full px-4" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                  {textMessage.message}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

