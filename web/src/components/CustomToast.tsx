import React, { useEffect, useRef, useState } from 'react';

interface ToastData {
  id: string;
  type: 'info' | 'success' | 'error';
  title: string;
  message: string;
  onPress?: () => void;
}

interface CustomToastProps {
  toast: ToastData | null;
  onHide: () => void;
}

const CustomToast: React.FC<CustomToastProps> = ({ toast, onHide }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const glowRef = useRef<HTMLDivElement>(null);
  const shimmerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (toast) {
      setIsVisible(true);
      setIsAnimating(true);
      
      // Auto hide after 5 seconds
      const timer = setTimeout(() => {
        hideToast();
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [toast]);

  const hideToast = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsVisible(false);
      onHide();
    }, 350);
  };

  if (!toast || !isVisible) return null;

  const getColors = () => {
    switch (toast.type) {
      case 'success':
        return {
          primary: '#10B981',
          secondary: '#34D399',
          accent: '#6EE7B7',
          gradient: 'linear-gradient(135deg, #1a1f2e 0%, #1e2332 50%, #222536 100%)',
          glow: 'rgba(16, 185, 129, 0.5)',
          borderGlow: '#34D399',
        };
      case 'error':
        return {
          primary: '#EF4444',
          secondary: '#F87171',
          accent: '#FCA5A5',
          gradient: 'linear-gradient(135deg, #1a1f2e 0%, #1e2332 50%, #222536 100%)',
          glow: 'rgba(239, 68, 68, 0.5)',
          borderGlow: '#F87171',
        };
      default:
        return {
          primary: '#8B5CF6',
          secondary: '#A78BFA',
          accent: '#C4B5FD',
          gradient: 'linear-gradient(135deg, #1a1f2e 0%, #1e2332 50%, #222536 100%)',
          glow: 'rgba(139, 92, 246, 0.5)',
          borderGlow: '#60A5FA',
        };
    }
  };

  const colors = getColors();

  return (
    <div
      className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] transition-all duration-350 ${
        isAnimating
          ? 'translate-y-0 opacity-100 scale-100'
          : '-translate-y-32 opacity-0 scale-95'
      }`}
      style={{
        pointerEvents: 'none',
      }}
    >
      <div
        className="relative cursor-pointer group"
        onClick={() => {
          if (toast.onPress) {
            toast.onPress();
          }
          hideToast();
        }}
        style={{
          width: '92%',
          maxWidth: '420px',
          pointerEvents: 'auto',
        }}
      >
        {/* Glow effect */}
        <div
          ref={glowRef}
          className="absolute -inset-2 rounded-3xl blur-xl opacity-40 animate-pulse"
          style={{
            background: colors.glow,
            animation: 'glowPulse 2s ease-in-out infinite',
          }}
        />

        {/* Main toast container */}
        <div
          className="relative rounded-2xl p-4 pl-5 min-h-[70px] overflow-hidden border border-white/8 backdrop-blur-sm"
          style={{
            background: colors.gradient,
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08) inset',
          }}
        >
          {/* Animated left accent line with glow */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl animate-pulse"
            style={{
              background: colors.borderGlow,
              boxShadow: `0 0 12px ${colors.borderGlow}, 0 0 24px ${colors.borderGlow}40`,
            }}
          />

          {/* Shimmer effect */}
          <div
            ref={shimmerRef}
            className="absolute inset-0 opacity-10"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.2) 50%, transparent 100%)',
              animation: 'shimmer 3s ease-in-out infinite',
              transform: 'skewX(-20deg)',
            }}
          />

          {/* Content */}
          <div className="relative flex flex-col z-10 pl-1">
            {/* Title */}
            <h3
              className="text-white font-bold text-base mb-1.5 leading-tight"
              style={{
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
                letterSpacing: '0.5px',
              }}
            >
              {toast.title}
            </h3>
            
            {/* Message */}
            {toast.message && (
              <p
                className="text-sm leading-relaxed line-clamp-2 font-medium"
                style={{
                  color: colors.accent,
                  letterSpacing: '0.3px',
                }}
              >
                {toast.message}
              </p>
            )}
          </div>

          {/* Animated glow particles */}
          <div
            className="absolute w-16 h-16 rounded-full -top-5 -right-5 opacity-30"
            style={{
              background: colors.borderGlow,
              boxShadow: `0 0 20px ${colors.borderGlow}`,
              animation: 'particleFloat 3s ease-in-out infinite',
            }}
          />
          <div
            className="absolute w-10 h-10 rounded-full -bottom-4 left-12 opacity-20"
            style={{
              background: colors.borderGlow,
              boxShadow: `0 0 15px ${colors.borderGlow}`,
              animation: 'particleFloat 4s ease-in-out infinite 0.5s',
            }}
          />
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes glowPulse {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.05);
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-200%) skewX(-20deg);
          }
          100% {
            transform: translateX(200%) skewX(-20deg);
          }
        }


        @keyframes particleFloat {
          0%, 100% {
            transform: translateY(0) scale(1);
            opacity: 0.2;
          }
          50% {
            transform: translateY(-10px) scale(1.1);
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  );
};

export default CustomToast;
