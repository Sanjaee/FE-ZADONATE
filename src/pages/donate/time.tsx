"use client";

import React, { useState, useEffect, useRef } from "react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface TimeMessage {
  type: string;
  targetTime?: string;
}

export default function TimePage() {
  const [targetDateTime, setTargetDateTime] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isExpired, setIsExpired] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = process.env.NEXT_PUBLIC_WS_HOST || "localhost:5000";
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
                const data: TimeMessage = JSON.parse(trimmed);

                if (data.type === "time" && data.targetTime) {
                  setTargetDateTime(data.targetTime);
                  setIsVisible(true);
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

  // Countdown timer
  useEffect(() => {
    if (!targetDateTime) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const target = new Date(targetDateTime).getTime();
      const difference = target - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setIsExpired(true);
        return;
      }

      setIsExpired(false);
      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDateTime]);

  const formatNumber = (num: number): string => {
    return num.toString().padStart(2, "0");
  };

  // Completely hidden when not visible
  if (!isVisible || !targetDateTime) {
    return <div className="hidden" />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-5xl">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <h1 className="text-5xl font-bold text-black dark:text-zinc-50">
                Countdown Timer
              </h1>
            </div>
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
              {isExpired ? "Waktu telah habis" : "Menuju target waktu"}
            </p>
          </div>

          {/* Countdown Display */}
          {isExpired ? (
            <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-800">
              <div className="text-7xl font-bold text-red-600 dark:text-red-400 mb-4">
                Time&apos;s Up!
              </div>
              <p className="text-xl text-zinc-600 dark:text-zinc-400">
                Countdown telah mencapai nol
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Days */}
              <div className="text-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 transform transition-all hover:scale-105">
                <div className="text-6xl font-bold text-orange-500 dark:text-orange-400 mb-3">
                  {formatNumber(timeLeft.days)}
                </div>
                <div className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                  Hari
                </div>
              </div>

              {/* Hours */}
              <div className="text-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 transform transition-all hover:scale-105">
                <div className="text-6xl font-bold text-orange-500 dark:text-orange-400 mb-3">
                  {formatNumber(timeLeft.hours)}
                </div>
                <div className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                  Jam
                </div>
              </div>

              {/* Minutes */}
              <div className="text-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 transform transition-all hover:scale-105">
                <div className="text-6xl font-bold text-orange-500 dark:text-orange-400 mb-3">
                  {formatNumber(timeLeft.minutes)}
                </div>
                <div className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                  Menit
                </div>
              </div>

              {/* Seconds */}
              <div className="text-center p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 transform transition-all hover:scale-105 animate-pulse">
                <div className="text-6xl font-bold text-orange-500 dark:text-orange-400 mb-3">
                  {formatNumber(timeLeft.seconds)}
                </div>
                <div className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                  Detik
                </div>
              </div>
            </div>
          )}

          {/* Target Date Info */}
          {!isExpired && targetDateTime && (
            <div className="mt-8 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-500">
                Target: {new Date(targetDateTime).toLocaleString("id-ID", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
