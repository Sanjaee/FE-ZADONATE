"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";

interface DonationMessage {
  id?: string; // UUID for tracking this donation
  type: string;
  donorName?: string;
  amount?: number; // Integer amount (in IDR for duration calculation)
  message?: string;
  mediaUrl?: string;
  mediaType?: string;
  startTime?: number; // Start time in seconds for YouTube videos (legacy)
  targetTime?: string | number; // Start time in seconds for YouTube videos (can be string or number)
  duration?: number; // Display duration in milliseconds (from backend)
  visible?: boolean;
  paymentMethod?: string; // crypto, bank_transfer, gopay, etc
  paymentType?: string; // plisio, midtrans
  plisioCurrency?: string; // BTC, ETH, SOL, etc
  plisioAmount?: string; // Crypto amount (e.g., "0.001", "0.5")
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

// Helper function to extract Instagram Reel ID and type
function extractInstagramId(url: string): { id: string; type: "reel" | "post" } | null {
  const reelPattern = /instagram\.com\/reel\/([^\/\?]+)/;
  const postPattern = /instagram\.com\/p\/([^\/\?]+)/;
  
  const reelMatch = url.match(reelPattern);
  if (reelMatch && reelMatch[1]) {
    return { id: reelMatch[1], type: "reel" };
  }
  
  const postMatch = url.match(postPattern);
  if (postMatch && postMatch[1]) {
    return { id: postMatch[1], type: "post" };
  }

  return null;
}

// Helper function to extract TikTok video ID from URL
function extractTikTokId(url: string): string | null {
  // TikTok URL formats:
  // https://www.tiktok.com/@username/video/VIDEO_ID?query=params
  // https://vm.tiktok.com/CODE
  // https://tiktok.com/@username/video/VIDEO_ID
  const patterns = [
    /tiktok\.com\/@[^\/\?]+\/video\/(\d+)/,  // Match @username/video/ID with optional query params
    /tiktok\.com\/.*\/video\/(\d+)/,         // Match any path with /video/ID
    /vm\.tiktok\.com\/([^\/\?]+)/,           // Match vm.tiktok.com short links
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

// Helper function to check if URL is Instagram
function isInstagramUrl(url: string): boolean {
  return /instagram\.com/.test(url);
}

// Helper function to check if URL is TikTok
function isTikTokUrl(url: string): boolean {
  return /tiktok\.com/.test(url);
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
  const [mediaType, setMediaType] = useState<"image" | "video" | "youtube" | "instagram" | "tiktok" | null>(null);
  const [startTime, setStartTime] = useState<number>(0); // Start time in seconds for YouTube videos
  const [donationMessage, setDonationMessage] = useState<{
    id: string; // UUID for tracking
    donorName: string;
    amount: number; // Integer amount (in IDR for duration calculation)
    message?: string;
    paymentMethod?: string;
    paymentType?: string;
    plisioCurrency?: string;
    plisioAmount?: string;
  } | null>(null);
  const [currentDonationId, setCurrentDonationId] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pauseStartTimeRef = useRef<number | null>(null);
  const donationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const youtubePlayerRef = useRef<any>(null); // YouTube Player instance
  const youtubeIframeRef = useRef<HTMLIFrameElement | null>(null);
  const donationStateRef = useRef<{
    donationMessage: typeof donationMessage;
    totalDuration: number;
    remainingTime: number;
    startTime: number;
  }>({
    donationMessage: null,
    totalDuration: 0,
    remainingTime: 0,
    startTime: 0,
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
                const data: DonationMessage = JSON.parse(trimmed);

                 switch (data.type) {
                   case "donation":
                     if (data.donorName && data.amount !== undefined && data.amount > 0 && data.id) {
                       // Check if current donation is still active (has remaining time)
                       const currentState = donationStateRef.current;
                       
                       // If there's an ongoing donation (regardless of donor name), ignore new donation
                       // This ensures donations queue properly and don't interrupt each other
                       if (currentState.donationMessage && currentState.remainingTime > 0) {
                         const isSameDonor = currentState.donationMessage.donorName === data.donorName;
                         console.log("⏸️ New donation received but current donation still active, ignoring:", {
                           currentId: currentDonationId,
                           currentDonor: currentState.donationMessage.donorName,
                           newId: data.id,
                           newDonor: data.donorName,
                           isSameDonor: isSameDonor,
                           remainingTime: currentState.remainingTime,
                         });
                         // Don't process new donation until current one finishes (queue will handle it)
                         return;
                       }
                       
                       // Only reset if current donation has finished
                       if (currentDonationId && currentDonationId !== data.id) {
                         // Current donation finished, safe to reset
                         console.log("🔄 New donation received, resetting previous video:", {
                           oldId: currentDonationId,
                           newId: data.id,
                         });
                         
                         // Stop and reset video if playing
                         if (videoRef.current) {
                           try {
                             videoRef.current.pause();
                             videoRef.current.currentTime = 0;
                           } catch (e) {
                             console.warn("Error resetting video:", e);
                           }
                         }
                         
                         // Destroy YouTube player if exists
                         if (youtubePlayerRef.current) {
                           try {
                             youtubePlayerRef.current.destroy();
                           } catch (e) {
                             console.warn("Error destroying YouTube player:", e);
                           }
                           youtubePlayerRef.current = null;
                         }
                         
                         // Clear timers
                         if (donationTimerRef.current) {
                           clearTimeout(donationTimerRef.current);
                           donationTimerRef.current = null;
                         }
                         if (progressIntervalRef.current) {
                           clearInterval(progressIntervalRef.current);
                           progressIntervalRef.current = null;
                         }
                       }
                       
                       // Validate message max 160 characters
                       const message = data.message && data.message.length > 160 
                         ? data.message.substring(0, 160) 
                         : data.message;
                       
                       // Use duration from backend, fallback to calculated if not provided
                       const duration = data.duration || calculateDisplayDuration(data.amount);
                       
                       console.log("📥 Received donation:", {
                         id: data.id,
                         donorName: data.donorName,
                         amount: data.amount,
                         durationFromBackend: data.duration,
                         calculatedDuration: calculateDisplayDuration(data.amount),
                         finalDuration: duration,
                       });
                       
                       // Set duration FIRST before setting donation message
                       // This ensures useEffect has the correct duration when it runs
                       setTotalDuration(duration);
                       setRemainingTime(duration);
                       
                       setDonationMessage({
                         id: data.id,
                         donorName: data.donorName,
                         amount: data.amount,
                         message: message,
                         paymentMethod: data.paymentMethod,
                         paymentType: data.paymentType,
                         plisioCurrency: data.plisioCurrency,
                         plisioAmount: data.plisioAmount,
                       });
                       setCurrentDonationId(data.id);
                       setIsVisible(true);
                       pauseStartTimeRef.current = null;
                     }
                     break;

              case "media":
                if (data.mediaUrl && data.id) {
                  // Check if current donation is still active (has remaining time)
                  const currentState = donationStateRef.current;
                  
                  // If there's an ongoing donation (regardless of donor name), ignore new media
                  // This ensures donations queue properly and don't interrupt each other
                  if (currentState.donationMessage && currentState.remainingTime > 0) {
                    console.log("⏸️ New media received but current donation still active, ignoring:", {
                      currentId: currentDonationId,
                      currentDonor: currentState.donationMessage.donorName,
                      newId: data.id,
                      remainingTime: currentState.remainingTime,
                    });
                    // Don't process new media until current donation finishes (queue will handle it)
                    return;
                  }
                  
                  // Only reset if current donation has finished
                  if (currentDonationId && currentDonationId !== data.id) {
                    // Current donation finished, safe to reset
                    console.log("🔄 New media received, resetting previous video:", {
                      oldId: currentDonationId,
                      newId: data.id,
                    });
                    
                    // Stop and reset video if playing
                    if (videoRef.current) {
                      try {
                        videoRef.current.pause();
                        videoRef.current.currentTime = 0;
                      } catch (e) {
                        console.warn("Error resetting video:", e);
                      }
                    }
                    
                    // Destroy YouTube player if exists
                    if (youtubePlayerRef.current) {
                      try {
                        youtubePlayerRef.current.destroy();
                      } catch (e) {
                        console.warn("Error destroying YouTube player:", e);
                      }
                      youtubePlayerRef.current = null;
                    }
                  }
                  
                  setMediaUrl(data.mediaUrl);
                  setCurrentDonationId(data.id);
                  setIsVisible(true);
                  pauseStartTimeRef.current = null;
                  // Set start time for YouTube videos - prioritize targetTime over startTime
                  let parsedStartTime = 0;
                  if (data.targetTime !== undefined) {
                    // targetTime can be string or number
                    if (typeof data.targetTime === "string") {
                      const parsed = parseInt(data.targetTime, 10);
                      if (!isNaN(parsed) && parsed >= 0) {
                        parsedStartTime = parsed;
                      }
                    } else if (typeof data.targetTime === "number" && data.targetTime >= 0) {
                      parsedStartTime = data.targetTime;
                    }
                  } else if (data.startTime !== undefined && data.startTime >= 0) {
                    // Fallback to legacy startTime
                    parsedStartTime = data.startTime;
                  }
                  setStartTime(parsedStartTime);
                  // Auto-detect platform or use provided mediaType
                  if (isYouTubeUrl(data.mediaUrl)) {
                    setMediaType("youtube");
                  } else if (isInstagramUrl(data.mediaUrl)) {
                    setMediaType("instagram");
                  } else if (isTikTokUrl(data.mediaUrl)) {
                    setMediaType("tiktok");
                  } else {
                    setMediaType((data.mediaType as "image" | "video" | "youtube" | "instagram" | "tiktok") || "image");
                  }
                }
                break;

              case "clear_queue":
                console.log("🗑️ Clear queue message received, stopping all videos and clearing queue");
                
                // Stop and reset video if playing
                if (videoRef.current) {
                  try {
                    videoRef.current.pause();
                    videoRef.current.currentTime = 0;
                  } catch (e) {
                    console.warn("Error stopping video:", e);
                  }
                }
                
                // Destroy YouTube player if exists
                if (youtubePlayerRef.current) {
                  try {
                    youtubePlayerRef.current.destroy();
                  } catch (e) {
                    console.warn("Error destroying YouTube player:", e);
                  }
                  youtubePlayerRef.current = null;
                }
                
                // Clear YouTube iframe
                if (youtubeIframeRef.current) {
                  youtubeIframeRef.current = null;
                }
                
                // Clear all timers
                if (donationTimerRef.current) {
                  clearTimeout(donationTimerRef.current);
                  donationTimerRef.current = null;
                }
                if (progressIntervalRef.current) {
                  clearInterval(progressIntervalRef.current);
                  progressIntervalRef.current = null;
                }
                
                // Clear all state
                setMediaUrl(null);
                setMediaType(null);
                setStartTime(0);
                setDonationMessage(null);
                setCurrentDonationId(null);
                setIsVisible(true);
                setRemainingTime(0);
                setTotalDuration(0);
                setVideoDuration(0);
                pauseStartTimeRef.current = null;
                
                // Clear donation state ref
                donationStateRef.current = {
                  donationMessage: null,
                  totalDuration: 0,
                  remainingTime: 0,
                  startTime: 0,
                };
                
                console.log("✅ All videos stopped and queue cleared");
                break;

              case "visibility":
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
                  } else {
                    // Paused - record pause start time
                    pauseStartTimeRef.current = Date.now();
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

  // Update donation state ref whenever state changes (for YouTube player access)
  useEffect(() => {
    donationStateRef.current = {
      donationMessage,
      totalDuration,
      remainingTime,
      startTime,
    };
  }, [donationMessage, totalDuration, remainingTime, startTime]);

  // Auto-hide based on donation duration from backend
  // Progress bar always follows donation duration, video stops when finished but content stays
  useEffect(() => {
    if (!donationMessage) {
      // Clean up when no donation message
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
    const currentDuration = totalDuration > 0 ? totalDuration : calculateDisplayDuration(donationMessage.amount);
    
    console.log("⏱️ Timer setup:", {
      donationId: donationMessage.id,
      amount: donationMessage.amount,
      totalDuration,
      calculatedDuration: calculateDisplayDuration(donationMessage.amount),
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
          
          // Destroy YouTube player before closing if YouTube video is playing
          if (youtubePlayerRef.current && mediaType === "youtube") {
            try {
              youtubePlayerRef.current.destroy();
            } catch (e) {
              console.warn("Error destroying YouTube player on progress end:", e);
            }
            youtubePlayerRef.current = null;
          }
          
          // Close when time is up
          setMediaUrl(null);
          setMediaType(null);
          setStartTime(0);
          setDonationMessage(null);
          setCurrentDonationId(null);
          setRemainingTime(0);
          setTotalDuration(0);
          setVideoDuration(0);
          setIsVisible(true);
          pauseStartTimeRef.current = null;
        }
        return newTime;
      });
    }, 1000);

    // Use currentDuration for timer
    donationTimerRef.current = setTimeout(() => {
      // Destroy YouTube player before closing
      if (youtubePlayerRef.current && mediaType === "youtube") {
        try {
          youtubePlayerRef.current.destroy();
        } catch (e) {
          console.warn("Error destroying YouTube player on timer end:", e);
        }
        youtubePlayerRef.current = null;
      }
      
      setMediaUrl(null);
      setMediaType(null);
      setStartTime(0);
      setDonationMessage(null);
      setCurrentDonationId(null);
      setRemainingTime(0);
      setTotalDuration(0);
      setVideoDuration(0);
      setIsVisible(true);
      pauseStartTimeRef.current = null;
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      donationTimerRef.current = null;
    }, currentDuration);

    return () => {
      if (donationTimerRef.current) {
        clearTimeout(donationTimerRef.current);
        donationTimerRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [donationMessage, isVisible, totalDuration]);

  // Handle media without donation (video only)
  useEffect(() => {
    if (mediaUrl && !donationMessage && mediaType === "video") {
      const finalDuration = videoDuration > 0 ? videoDuration * 1000 : 10000;
      const timer = setTimeout(() => {
        setMediaUrl(null);
        setMediaType(null);
        setStartTime(0);
        setVideoDuration(0);
      }, finalDuration);

      return () => clearTimeout(timer);
    }
  }, [mediaUrl, donationMessage, mediaType, videoDuration]);

  // Handle video metadata loaded and video ended event
  useEffect(() => {
    if (videoRef.current && mediaType === "video") {
      const video = videoRef.current;
      
      const handleLoadedMetadata = () => {
        if (video.duration && !isNaN(video.duration) && isFinite(video.duration)) {
          setVideoDuration(video.duration);
        }
      };

      const handleEnded = () => {
        // Check if donation duration is still remaining using ref (latest state)
        setTimeout(() => {
          const currentState = donationStateRef.current;
        
          // Check if donation is still active
          if (!currentState.donationMessage || currentState.totalDuration <= 0 || currentState.remainingTime <= 0) {
            // Donation closed or duration finished, pause video
            console.log("✅ Donation duration finished, closing video");
            video.pause();
            video.currentTime = video.duration;
            return;
          }
          
          // Donation still active, loop the video
          console.log("🔄 Looping video - donation duration still active", {
            remainingTime: currentState.remainingTime,
            totalDuration: currentState.totalDuration,
          });
          
          try {
            // Restart video from beginning
            video.currentTime = 0;
            video.play();
          } catch (e) {
            console.error("Error looping video:", e);
          }
        }, 100);
      };

      const handleTimeUpdate = () => {
        // Only prevent looping if donation has ended
        // If donation is still active, allow video to loop
        if (video.ended && (!donationMessage || remainingTime <= 0)) {
          // Donation ended, prevent video from restarting
          if (video.currentTime < video.duration) {
          video.pause();
          video.currentTime = video.duration;
        }
        }
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("ended", handleEnded);
      video.addEventListener("timeupdate", handleTimeUpdate);

      // Auto-play video when loaded
      const handleCanPlay = () => {
        try {
          video.play().catch((e) => {
            console.warn("Error auto-playing video:", e);
          });
        } catch (e) {
          console.warn("Error auto-playing video:", e);
        }
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("ended", handleEnded);
      video.addEventListener("timeupdate", handleTimeUpdate);
      video.addEventListener("canplay", handleCanPlay);

      // Check if already loaded
      if (video.readyState >= 1) {
        handleLoadedMetadata();
      }
      
      // Try to play immediately if video is ready
      if (video.readyState >= 3) {
        video.play().catch((e) => {
          console.warn("Error auto-playing video:", e);
        });
      }

      return () => {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("ended", handleEnded);
        video.removeEventListener("timeupdate", handleTimeUpdate);
        video.removeEventListener("canplay", handleCanPlay);
      };
    }
  }, [mediaUrl, mediaType, videoDuration]);

  // Load YouTube IFrame API and handle YouTube video ended
  useEffect(() => {
    if (mediaType === "youtube" && mediaUrl && extractYouTubeId(mediaUrl)) {
      const videoId = extractYouTubeId(mediaUrl);
      if (!videoId) return;

      // Load YouTube IFrame API if not already loaded
      const loadYouTubeAPI = () => {
        if (window.YT && window.YT.Player) {
          initializeYouTubePlayer(videoId);
        } else {
          // Load YouTube IFrame API script
          const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
          if (!existingScript) {
            const script = document.createElement("script");
            script.src = "https://www.youtube.com/iframe_api";
            script.async = true;
            window.onYouTubeIframeAPIReady = () => {
              initializeYouTubePlayer(videoId);
            };
            document.body.appendChild(script);
          } else {
            // Script already loaded, initialize player
            setTimeout(() => {
              initializeYouTubePlayer(videoId);
            }, 100);
          }
        }
      };

      const initializeYouTubePlayer = (id: string) => {
        try {
          // Find the iframe element
          const iframe = document.querySelector(`iframe[src*="${id}"]`) as HTMLIFrameElement;
          if (!iframe) {
            // Wait a bit for iframe to be created
            setTimeout(() => initializeYouTubePlayer(id), 100);
            return;
          }
          if (!window.YT || !window.YT.Player) {
            setTimeout(() => initializeYouTubePlayer(id), 100);
            return;
          }

          // Create YouTube player instance
          const player = new window.YT.Player(iframe, {
            events: {
              onStateChange: (event: any) => {
                // YT.PlayerState.ENDED = 0
                if (event.data === 0) {
                  console.log("🎬 YouTube video ended");
                  
                  // Check if donation duration is still remaining using ref (latest state)
                  setTimeout(() => {
                    const currentState = donationStateRef.current;
                  
                    // Check if donation is still active
                    if (!currentState.donationMessage || currentState.totalDuration <= 0 || currentState.remainingTime <= 0) {
                      // Donation closed or duration finished, destroy player
                      console.log("✅ Donation duration finished, closing YouTube video");
                      if (youtubePlayerRef.current) {
                        try {
                          youtubePlayerRef.current.destroy();
                        } catch (e) {
                          console.warn("Error destroying YouTube player:", e);
                        }
                        youtubePlayerRef.current = null;
                      }
                      return;
                    }
                    
                    // Donation still active, loop the video
                    console.log("🔄 Looping YouTube video - donation duration still active", {
                      remainingTime: currentState.remainingTime,
                      totalDuration: currentState.totalDuration,
                    });
                    
                    try {
                      const ytPlayer = player as any; // YouTube Player API type
                      // Seek to start time and play again
                      if (currentState.startTime > 0) {
                        ytPlayer.seekTo(currentState.startTime, true);
                        } else {
                        ytPlayer.seekTo(0, true);
                        }
                        player.playVideo();
                      } catch (e) {
                      console.error("Error looping YouTube video:", e);
                      }
                    }, 100);
                }
              },
              onReady: (event: any) => {
                console.log("✅ YouTube player ready");
                youtubePlayerRef.current = event.target;
              },
            },
          });
        } catch (error) {
          console.error("Error initializing YouTube player:", error);
        }
      };

      loadYouTubeAPI();

      return () => {
        // Cleanup YouTube player
        if (youtubePlayerRef.current) {
          try {
            youtubePlayerRef.current.destroy();
          } catch (e) {
            console.warn("Error destroying YouTube player on cleanup:", e);
          }
          youtubePlayerRef.current = null;
        }
      };
    }
  }, [mediaType, mediaUrl]);

  // Load TikTok embed script when TikTok media is shown
  useEffect(() => {
    if (mediaType === "tiktok" && mediaUrl) {
      const loadTikTok = () => {
        // Force TikTok to re-render embed
        // @ts-expect-error - TikTok embed global function is injected by embed.js
        if (window.tiktokEmbedLoad) {
          // @ts-expect-error - TikTok embed global function is injected by embed.js
          window.tiktokEmbedLoad();
        }
      };

      // Check if script already exists
      const existingScript = document.querySelector('script[src="https://www.tiktok.com/embed.js"]');
      
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://www.tiktok.com/embed.js";
        script.async = true;
        script.onload = loadTikTok;
        document.body.appendChild(script);
      } else {
        // Script already loaded, trigger re-render
        setTimeout(loadTikTok, 100);
      }

      // Also trigger after a short delay to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        loadTikTok();
      }, 500);

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [mediaType, mediaUrl]);

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
  if (!mediaUrl && !donationMessage) {
    return <div className="hidden" />;
  }

  if (!isVisible) {
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
              ref={videoRef}
              src={mediaUrl}
              autoPlay
              playsInline
              loop={false}
              className="w-full h-full object-contain"
            />
          )}
          {mediaType === "youtube" && extractYouTubeId(mediaUrl) && (
            <iframe
              ref={youtubeIframeRef}
              key={`${mediaUrl}-${startTime}`}
              src={`https://www.youtube.com/embed/${extractYouTubeId(mediaUrl)}?autoplay=1&mute=0&controls=0&rel=0&modestbranding=1&playsinline=1&start=${startTime}&enablejsapi=1`}
              className="w-full h-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              style={{ border: "none" }}
            />
          )}
          {mediaType === "instagram" && extractInstagramId(mediaUrl) && (() => {
            const instagramData = extractInstagramId(mediaUrl);
            if (!instagramData) return null;
            
            const embedUrl = instagramData.type === "reel"
              ? `https://www.instagram.com/reel/${instagramData.id}/embed/?autoplay=1&playsinline=1`
              : `https://www.instagram.com/p/${instagramData.id}/embed/?autoplay=1&playsinline=1`;
            
            return (
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="encrypted-media; autoplay; fullscreen"
                allowFullScreen
                style={{ border: "none" }}
                scrolling="no"
                frameBorder="0"
              />
            );
          })()}
          {mediaType === "tiktok" && mediaUrl && extractTikTokId(mediaUrl) && (
            <div className="w-full h-full flex items-center justify-center bg-black">
              <blockquote
                className="tiktok-embed"
                cite={mediaUrl}
                data-video-id={extractTikTokId(mediaUrl)!}
                style={{ maxWidth: "100%", minWidth: "325px" }}
              >
                <section />
              </blockquote>
            </div>
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
                {donationMessage.paymentMethod === "crypto" && donationMessage.plisioCurrency && donationMessage.plisioAmount ? (
                  <span className="text-[#FFB703]">
                    {parseFloat(donationMessage.plisioAmount).toLocaleString("id-ID", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 8,
                    })}{" "}
                    {donationMessage.plisioCurrency}
                  </span>
                ) : (
                <span className="text-[#FFB703]">
                  Rp{donationMessage.amount.toLocaleString("id-ID")}
                </span>
                )}
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
