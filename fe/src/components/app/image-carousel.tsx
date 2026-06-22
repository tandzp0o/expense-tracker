import React, { useEffect, useState } from "react";

export interface ImageCarouselProps {
  images: string[];
  alt: string;
  fallback?: React.ReactNode;
}

export const ImageCarousel: React.FC<ImageCarouselProps> = ({
  images,
  alt,
  fallback = null,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const extendedImages = images.length > 1 ? [...images, images[0]] : images;

  useEffect(() => {
    if (images.length < 2) {
      setActiveIndex(0);
      setTransitionEnabled(true);
      return;
    }

    const intervalId = window.setInterval(() => {
      setTransitionEnabled(true);
      setActiveIndex((current) => current + 1);
    }, 3200);

    return () => window.clearInterval(intervalId);
  }, [images]);

  useEffect(() => {
    if (transitionEnabled || activeIndex !== 0) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setTransitionEnabled(true);
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeIndex, transitionEnabled]);

  if (images.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        {fallback}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="flex h-full ease-out"
        onTransitionEnd={() => {
          if (images.length > 1 && activeIndex === images.length) {
            setTransitionEnabled(false);
            setActiveIndex(0);
          }
        }}
        style={{
          width: `${extendedImages.length * 100}%`,
          transform: `translateX(-${activeIndex * (100 / extendedImages.length)}%)`,
          transition: transitionEnabled ? "transform 700ms ease-out" : "none",
        }}
      >
        {extendedImages.map((image, index) => (
          <div
            key={`${image}-${index}`}
            className="h-full shrink-0"
            style={{ width: `${100 / extendedImages.length}%` }}
          >
            <img
              alt={`${alt}-${index + 1}`}
              className="h-full w-full object-cover"
              src={image}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
