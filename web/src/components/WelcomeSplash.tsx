import React, { useEffect, useState } from 'react';
import { Gamepad2 } from 'lucide-react';

interface WelcomeSplashProps {
  onComplete: () => void;
  username?: string;
}

const WelcomeSplash: React.FC<WelcomeSplashProps> = ({ onComplete, username }) => {
  const [fadeOpacity, setFadeOpacity] = useState(0);
  const [scale, setScale] = useState(0.8);
  const [translateY, setTranslateY] = useState(50);

  useEffect(() => {
    // Start animation sequence
    const startTime = Date.now();
    const duration = 800;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

      if (progress < 1) {
        const eased = easeOut(progress);
        
        // Fade in
        setFadeOpacity(eased);
        
        // Scale animation (spring-like)
        const springProgress = 1 - Math.pow(1 - progress, 3);
        setScale(0.8 + (1 - 0.8) * springProgress);
        
        // Slide up
        setTranslateY(50 * (1 - eased));
        
        requestAnimationFrame(animate);
      } else {
        // Animation complete
        setFadeOpacity(1);
        setScale(1);
        setTranslateY(0);
      }
    };

    requestAnimationFrame(animate);

    // After animation completes, wait a bit then redirect
    const timer = setTimeout(() => {
      onComplete();
    }, 2500); // Show splash for 2.5 seconds total

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
      }}
    >
      <div
        className="flex flex-col items-center justify-center"
        style={{
          opacity: fadeOpacity,
          transform: `scale(${scale}) translateY(${translateY}px)`,
          transition: 'opacity 0.1s ease-out, transform 0.1s ease-out',
        }}
      >
        <div className="mb-8">
          <div
            className="w-[120px] h-[120px] rounded-[30px] flex items-center justify-center shadow-[0_0_20px_rgba(147,51,234,0.8)]"
            style={{
              background: 'linear-gradient(135deg, #9333ea 0%, #3b82f6 50%, #06b6d4 100%)',
            }}
          >
            <Gamepad2 className="w-[60px] h-[60px] text-white" />
          </div>
        </div>

        <p
          className="text-[28px] text-purple-300 font-light tracking-[2px] mb-2.5"
          style={{
            opacity: fadeOpacity,
            transition: 'opacity 0.1s ease-out',
          }}
        >
          Welcome to
        </p>

        <h1
          className="text-[48px] font-bold text-white tracking-[3px]"
          style={{
            opacity: fadeOpacity,
            transition: 'opacity 0.1s ease-out',
            textShadow: '0 0 20px rgba(147, 51, 234, 0.5)',
          }}
        >
          Gamer Hive
        </h1>

        {username && (
          <p
            className="text-[20px] text-purple-400 mt-5 font-medium"
            style={{
              opacity: fadeOpacity,
              transition: 'opacity 0.1s ease-out',
            }}
          >
            {username}
          </p>
        )}
      </div>
    </div>
  );
};

export default WelcomeSplash;

