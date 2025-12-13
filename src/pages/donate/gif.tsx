"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";

interface DonationMessage {
  type: string;
  donorName?: string;
  amount?: number; // Integer amount
  message?: string;
  mediaUrl?: string;
  mediaType?: string;
  visible?: boolean;
}

// Helper function to extract YouTube video ID
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

// Helper function to check if URL is YouTube
function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/.test(url);
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

export default function GiftPage() {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | "youtube" | null>(null);
  const [donationMessage, setDonationMessage] = useState<{
    donorName: string;
    amount: number; // Integer amount
    message?: string;
  } | null>(null);
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = process.env.NEXT_PUBLIC_WS_HOST || "localhost:8080";
      const wsUrl = `${wsProtocol}//${wsHost}/ws`;

      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
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
                const data: DonationMessage = JSON.parse(trimmed);

                 switch (data.type) {
                   case "donation":
                     if (data.donorName && data.amount !== undefined && data.amount > 0) {
                       // Validate message max 160 characters
                       const message = data.message && data.message.length > 160 
                         ? data.message.substring(0, 160) 
                         : data.message;
                       
                       setDonationMessage({
                         donorName: data.donorName,
                         amount: data.amount,
                         message: message,
                       });
                     }
                     break;

              case "media":
                if (data.mediaUrl) {
                  setMediaUrl(data.mediaUrl);
                  // Auto-detect YouTube or use provided mediaType
                  if (isYouTubeUrl(data.mediaUrl)) {
                    setMediaType("youtube");
                  } else {
                    setMediaType((data.mediaType as "image" | "video") || "image");
                  }
                }
                break;
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

        ws.onerror = () => {
          // Silent error handling
        };

        ws.onclose = () => {
          // Reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 3000);
        };

        wsRef.current = ws;
      } catch {
        // Retry connection after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
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

  // Auto-hide based on donation amount (10k = 1 menit, setiap kelipatan 10k = +1 menit)
  useEffect(() => {
    if (donationMessage) {
      const duration = calculateDisplayDuration(donationMessage.amount);
      
      // Initialize state in next tick to avoid cascading renders
      setTimeout(() => {
        setTotalDuration(duration);
        setRemainingTime(duration);
      }, 0);

      // Update progress bar every second
      progressIntervalRef.current = setInterval(() => {
        setRemainingTime((prev) => {
          const newTime = Math.max(0, prev - 1000);
          if (newTime <= 0) {
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
            }
          }
          return newTime;
        });
      }, 1000);

      const timer = setTimeout(() => {
        setMediaUrl(null);
        setMediaType(null);
        setDonationMessage(null);
        setRemainingTime(0);
        setTotalDuration(0);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      }, duration);

      return () => {
        clearTimeout(timer);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      };
    } else if (mediaUrl && !donationMessage) {
      // If only media without donation, use default 10 seconds
      const timer = setTimeout(() => {
        setMediaUrl(null);
        setMediaType(null);
      }, 10000);

      return () => clearTimeout(timer);
    } else {
      // Clean up when no donation message
      setTimeout(() => {
        setRemainingTime(0);
        setTotalDuration(0);
      }, 0);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }
  }, [mediaUrl, donationMessage]);

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

  // Completely hidden when no content
  if (!mediaUrl && !donationMessage) {
    return <div className="hidden" />;
  }

  return (
    <div className="flex flex-col w-full h-screen bg-black overflow-hidden">
      {/* Media Section - Top */}
      {mediaUrl && (
        <div className="flex-1 w-full relative min-h-0">
          {mediaType === "image" && (
            <Image
              src={mediaUrl}
              alt="Background"
              fill
              className="object-contain"
              unoptimized
              priority
            />
          )}
          {mediaType === "video" && (
            <video
              src={mediaUrl}
              autoPlay
              loop
              playsInline
              className="w-full h-full object-contain"
            />
          )}
          {mediaType === "youtube" && extractYouTubeId(mediaUrl) && (
            <iframe
              src={`https://www.youtube.com/embed/${extractYouTubeId(mediaUrl)}?autoplay=1&loop=1&playlist=${extractYouTubeId(mediaUrl)}&controls=0&mute=0&rel=0&modestbranding=1&playsinline=1`}
              className="w-full h-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              style={{ border: "none" }}
            />
          )}
        </div>
      )}

      {/* Progress Bar - YouTube style */}
      {mediaUrl && donationMessage && totalDuration > 0 && (
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

      {/* Donation Description - Bottom */}
      {donationMessage && (
        <div className="w-full shrink-0 animate-[slideUp_0.5s_ease-out] mt-4">
          <div className="bg-black/80 backdrop-blur-sm px-4 py-2 shadow-2xl rounded-lg">
            <div className="flex flex-col items-center text-center">
              {/* Line 1: Donor name and amount */}
              <div className="text-white text-[30px] font-semibold break-words px-2" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                <span className="text-[#FFB703]">
                  {donationMessage.donorName}
                </span>{" "}
                baru saja memberikan{" "}
                <span className="text-[#FFB703]">
                  Rp{donationMessage.amount.toLocaleString("id-ID")}
                </span>
              </div>

              {/* Line 2: Optional message - moved down */}
              {donationMessage.message && (
                <div className="text-zinc-300 text-[30px] mt-2 break-words max-w-full px-4" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                  {donationMessage.message}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
