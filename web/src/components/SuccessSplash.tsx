import React, { useEffect } from 'react';
import { CheckCircle, Gamepad2 } from 'lucide-react';

interface SuccessSplashProps {
  message: string;
  onComplete: () => void;
}

const SuccessSplash: React.FC<SuccessSplashProps> = ({ message, onComplete }) => {
  useEffect(() => {
    // Auto-redirect after 2 seconds
    const timer = setTimeout(() => {
      onComplete();
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/30 to-blue-900/20 relative overflow-hidden flex items-center justify-center">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[url('https://images.pexels.com/photos/442576/pexels-photo-442576.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop')] bg-cover bg-center opacity-5"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-purple-900/50 to-blue-900/30"></div>
        
        {/* Floating Particles */}
        <div className="absolute top-20 left-20 w-2 h-2 bg-purple-400 rounded-full animate-pulse opacity-60"></div>
        <div className="absolute top-40 right-32 w-1 h-1 bg-blue-400 rounded-full animate-ping opacity-40"></div>
        <div className="absolute bottom-32 left-16 w-3 h-3 bg-cyan-400 rounded-full animate-bounce opacity-30"></div>
        <div className="absolute bottom-20 right-20 w-2 h-2 bg-purple-500 rounded-full animate-pulse opacity-50"></div>
      </div>

      {/* Success Content */}
      <div className="relative z-10 text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full shadow-2xl mb-6 relative animate-scale-in">
          <CheckCircle className="w-12 h-12 text-white" />
          <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-400 rounded-full blur opacity-50 animate-pulse"></div>
        </div>

        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 rounded-2xl shadow-2xl mb-6 relative">
          <Gamepad2 className="w-10 h-10 text-white" />
          <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-blue-400 rounded-2xl blur opacity-50 animate-pulse"></div>
        </div>

        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent mb-4">
          GamerHive
        </h1>

        <p className="text-2xl font-semibold text-green-400 mb-2 animate-fade-in">
          {message}
        </p>

        <p className="text-purple-300/70 text-sm animate-fade-in-delay">
          Redirecting you to the dashboard...
        </p>
      </div>

      <style>{`
        @keyframes scale-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes fade-in {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-scale-in {
          animation: scale-in 0.5s ease-out;
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        
        .animate-fade-in-delay {
          animation: fade-in 0.8s ease-out;
        }
      `}</style>
    </div>
  );
};

export default SuccessSplash;
