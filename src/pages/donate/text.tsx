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
  const textStateRef = useRef<{
    textMessage: typeof textMessage;
    remainingTime: number;
  }>({
    textMessage: null,
    remainingTime: 0,
  });

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
                  // Check if current donation is still active (has remaining time)
                  // If there's an ongoing donation (regardless of donor name), ignore new donation
                  // This ensures donations queue properly and don't interrupt each other
                  const currentState = textStateRef.current;
                  if (currentState.textMessage && currentState.remainingTime > 0) {
                    const isSameDonor = currentState.textMessage.donorName === data.donorName;
                    console.log("⏸️ New text donation received but current donation still active, ignoring:", {
                      currentId: currentDonationId,
                      currentDonor: currentState.textMessage.donorName,
                      newId: data.id,
                      newDonor: data.donorName,
                      isSameDonor: isSameDonor,
                      remainingTime: currentState.remainingTime,
                    });
                    // Don't process new donation until current one finishes (queue will handle it)
                    return;
                  }
                  
                  // Validate message max 250 characters (only for text donations)
                  // Handle undefined, null, or empty string
                  let message = data.message || "";
                  if (typeof message === "string" && message.length > 250) {
                    message = message.substring(0, 250);
                  }
                  
                  // Always use 10 seconds duration for text donations
                  const finalDuration = 10000; // 10 seconds
                  
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

                  // Play BGM once (no loop)
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0; // Reset to start
                    audioRef.current.loop = false; // Play BGM once only
                    
                    // Check if audio is ready
                    if (audioRef.current.readyState >= 2) { // HAVE_CURRENT_DATA or higher
                      audioRef.current.play()
                        .catch((err) => {
                          console.error("❌ Failed to play BGM:", err);
                          // Try to load again if failed
                          if (audioRef.current) {
                            audioRef.current.load();
                            setTimeout(() => {
                              if (audioRef.current) {
                                audioRef.current.play().catch((retryErr) => {
                                  console.error("❌ Retry play also failed:", retryErr);
                                });
                              }
                            }, 100);
                          }
                        });
                    } else {
                      // Wait for audio to be ready
                      const onCanPlay = () => {
                        if (audioRef.current) {
                          audioRef.current.play().catch((err) => {
                            console.error("❌ Failed to play BGM after ready:", err);
                          });
                          audioRef.current.removeEventListener("canplay", onCanPlay);
                        }
                      };
                      audioRef.current.addEventListener("canplay", onCanPlay);
                    }
                  }
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

  // Update text state ref whenever state changes
  useEffect(() => {
    textStateRef.current = {
      textMessage,
      remainingTime,
    };
  }, [textMessage, remainingTime]);

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio("/bgm.mp3");
      audio.loop = false; // Play BGM once only
      audio.preload = "auto";
      
      // Set volume (some browsers require this for autoplay)
      audio.volume = 1.0;
      
      // Add error handling
      audio.addEventListener("error", (e) => {
        console.error("❌ Audio error:", e);
      });
      
      // Try to preload by loading the audio (this helps with autoplay policy)
      try {
        audio.load();
      } catch (err) {
        console.warn("⚠️ Audio preload warning:", err);
      }
      
      audioRef.current = audio;
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
      // Stop BGM when no donation
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setTimeout(() => {
        setRemainingTime(0);
        setTotalDuration(0);
      }, 0);
      return;
    }

    // Always use 10 seconds duration for text donations
    const currentDuration = 10000; // 10 seconds
    
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

