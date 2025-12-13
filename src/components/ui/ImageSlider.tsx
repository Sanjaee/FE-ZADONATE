"use client";

import React, { useState, useEffect } from "react";
import { Button } from "./button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface ImageSliderProps {
  images: Array<{
    id: string;
    imageUrl: string;
    altText?: string;
    order?: number;
  }>;
  className?: string;
  showThumbnails?: boolean;
  showFullscreen?: boolean;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  height?: string;
}

export function ImageSlider({
  images,
  className = "",
  showThumbnails = true,
  showFullscreen = true,
  autoPlay = false,
  autoPlayInterval = 3000,
  height = "500px",
}: ImageSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [thumbnailScrollPosition, setThumbnailScrollPosition] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Auto play functionality
  React.useEffect(() => {
    if (autoPlay && images.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
      }, autoPlayInterval);
      return () => clearInterval(interval);
    }
  }, [autoPlay, autoPlayInterval, images.length]);

  // Auto-scroll thumbnails when main image changes
  React.useEffect(() => {
    const thumbnailsPerView = isMobile ? 4 : 6;

    if (images.length > thumbnailsPerView) {
      const maxScroll = Math.max(0, images.length - thumbnailsPerView);

      // Calculate the optimal scroll position to keep current image visible
      const optimalScroll = Math.max(0, Math.min(maxScroll, currentIndex - 2));
      setThumbnailScrollPosition(optimalScroll);
    }
  }, [currentIndex, images.length, isMobile]);

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const openFullscreen = () => {
    setIsFullscreen(true);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
  };

  // Handle click outside to close fullscreen
  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only close if clicking on the backdrop itself, not on child elements
    if (e.target === e.currentTarget) {
      closeFullscreen();
    }
  };

  const scrollThumbnailsLeft = () => {
    setThumbnailScrollPosition((prev) => Math.max(0, prev - 1));
  };

  const scrollThumbnailsRight = () => {
    const thumbnailsPerView = isMobile ? 4 : 6;
    const maxScroll = Math.max(0, images.length - thumbnailsPerView);
    setThumbnailScrollPosition((prev) => Math.min(maxScroll, prev + 1));
  };

  // Touch/Drag handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrevious();
    }
  };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setTouchEnd(null);
    setTouchStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (touchStart !== null) {
      setTouchEnd(e.clientX);
    }
  };

  const handleMouseUp = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrevious();
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isFullscreen) {
        switch (event.key) {
          case "ArrowLeft":
            goToPrevious();
            break;
          case "ArrowRight":
            goToNext();
            break;
          case "Escape":
            closeFullscreen();
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  if (!images || images.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`}
      >
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">📷</div>
          <p>No images available</p>
        </div>
      </div>
    );
  }

  const currentImage = images[currentIndex];

  return (
    <>
      <div className={`relative ${className}`}>
        {/* Main Image */}
        <div className="relative group">
          <img
            src={currentImage.imageUrl}
            alt={currentImage.altText || `Product image ${currentIndex + 1}`}
            className="w-full h-full object-cover rounded-lg cursor-pointer select-none"
            style={{ height }}
            onClick={showFullscreen ? openFullscreen : undefined}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              setTouchStart(null);
              setTouchEnd(null);
            }}
          />

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/80 hover:bg-white"
                onClick={goToPrevious}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/80 hover:bg-white"
                onClick={goToNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Image Counter */}
          {images.length > 1 && (
            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
              {currentIndex + 1} / {images.length}
            </div>
          )}

          {/* Fullscreen Button */}
          {showFullscreen && (
            <Button
              variant="outline"
              size="sm"
              className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/80 hover:bg-white"
              onClick={openFullscreen}
            >
              🔍
            </Button>
          )}
        </div>

        {/* Thumbnails - Desktop Only */}
        {showThumbnails && images.length > 1 && !isMobile && (
          <div className="relative mt-3 px-2 sm:px-3">
            {/* Thumbnail Navigation Arrows */}
            {images.length > 4 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={scrollThumbnailsLeft}
                  disabled={thumbnailScrollPosition === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg border-gray-200 hover:bg-gray-50 disabled:opacity-50 h-6 w-6 p-0 sm:h-8 sm:w-8"
                >
                  <svg
                    className="w-2 h-2 sm:w-3 sm:h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={scrollThumbnailsRight}
                  disabled={
                    thumbnailScrollPosition >=
                    Math.max(0, images.length - (isMobile ? 4 : 6))
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg border-gray-200 hover:bg-gray-50 disabled:opacity-50 h-6 w-6 p-0 sm:h-8 sm:w-8"
                >
                  <svg
                    className="w-2 h-2 sm:w-3 sm:h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Button>
              </>
            )}

            {/* Thumbnail Container */}
            <div className="overflow-hidden mx-6 sm:mx-10">
              <div
                className="flex gap-1 sm:gap-2 transition-transform duration-300 ease-in-out"
                style={{
                  transform: `translateX(-${
                    thumbnailScrollPosition * (isMobile ? 60 : 72)
                  }px)`, // 56px (w-14) + 4px (gap-1) for mobile, 64px (w-16) + 8px (gap-2) for desktop
                }}
              >
                {images.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => goToSlide(index)}
                    className={`flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                      index === currentIndex
                        ? "border-blue-500 ring-2 ring-blue-200"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <img
                      src={image.imageUrl}
                      alt={image.altText || `Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Dots Indicator */}
        {images.length > 1 && !showThumbnails && (
          <div className="flex justify-center gap-2 mt-3">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  index === currentIndex
                    ? "bg-blue-500"
                    : "bg-gray-300 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 backdrop-blur-md bg-white/90 flex items-center justify-center animate-in fade-in duration-300 cursor-pointer"
          onClick={handleBackdropClick}
        >
          {/* Content container that prevents click propagation */}
          <div
            className="relative max-w-4xl max-h-full p-4 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fullscreen Image */}
            <div
              className="relative animate-in zoom-in-95 duration-300 flex items-center justify-center"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                setTouchStart(null);
                setTouchEnd(null);
              }}
            >
              <img
                src={currentImage.imageUrl}
                alt={
                  currentImage.altText || `Product image ${currentIndex + 1}`
                }
                className="max-w-[600px] max-h-[600px] object-cover rounded-lg shadow-2xl select-none"
              />
            </div>

            {/* Mobile Thumbnails in Fullscreen */}
            {isMobile && showThumbnails && images.length > 1 && (
              <div className="absolute bottom-18 left-0 right-0 px-4">
                <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2">
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                    {images.map((image, index) => (
                      <button
                        key={image.id}
                        onClick={() => goToSlide(index)}
                        className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                          index === currentIndex
                            ? "border-blue-400 ring-2 ring-blue-200"
                            : "border-white/30 hover:border-white/60"
                        }`}
                      >
                        <img
                          src={image.imageUrl}
                          alt={image.altText || `Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Arrows */}
            {images.length > 1 && (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white"
                  onClick={goToPrevious}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white"
                  onClick={goToNext}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}

            {/* Image Counter */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded">
                {currentIndex + 1} / {images.length}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
