
import React from 'react';
import { X, ArrowLeft } from 'lucide-react';

const ConfettiPiece: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
  <div className="absolute w-2 h-4" style={style}></div>
);

const Confetti: React.FC = () => {
  const pieces = Array.from({ length: 150 }).map((_, i) => {
    const colors = ['#f97316', '#ec4899', '#8b5cf6', '#3b82f6', '#22c55e', '#eab308'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const randomX = Math.random() * 100;
    const randomY = -Math.random() * 100 - 10;
    const randomDelay = Math.random() * 5;
    const randomDuration = Math.random() * 5 + 5;
    const randomRotationStart = Math.random() * 360;
    const randomRotationEnd = Math.random() * 360 + 360;

    const keyframes = `
      @keyframes confetti-fall-${i} {
        from {
          transform: translateY(${randomY}vh) rotate(${randomRotationStart}deg);
          opacity: 1;
        }
        to {
          transform: translateY(110vh) rotate(${randomRotationEnd}deg);
          opacity: 0;
        }
      }
    `;

    return {
      id: i,
      keyframes,
      style: {
        backgroundColor: randomColor,
        left: `${randomX}vw`,
        animation: `confetti-fall-${i} ${randomDuration}s linear ${randomDelay}s infinite`,
      },
    };
  });

  return (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      <style>{pieces.map(p => p.keyframes).join('')}</style>
      {pieces.map(p => <ConfettiPiece key={p.id} style={p.style} />)}
    </div>
  );
};

interface CongratsModalProps {
  onClose: () => void;
}

const CongratsModal: React.FC<CongratsModalProps> = ({ onClose }) => {
  return (
    <>
      <Confetti />
      <div
        className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-500"
        onClick={onClose}
        dir="rtl"
      >
        <div
          className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl text-center animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors z-10"
          >
            <X size={20} />
          </button>
          
          <div className="pt-12 pb-8 px-8 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/50">
            <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-pink-500 mb-3">
              ألف مبرووووك!
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-lg">
              مبروك عليك، متجرك بقى مجاناً ومدى الحياة 🚀
              <br />
              هذا عرض مجاني مدى الحياة ولن تنتهي صلاحيته أبداً!
            </p>
            
            <div className="my-8 flex justify-center">
              <div className="relative w-48 h-48 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-purple-600 rounded-[45%] animate-pulse blur-xl opacity-50"></div>
                <div className="relative flex flex-col items-center justify-center w-44 h-44 bg-gradient-to-br from-red-500 via-orange-400 to-purple-500 text-white rounded-[45%] shadow-xl"
                  style={{ clipPath: 'polygon(50% 0%, 80% 10%, 100% 35%, 100% 70%, 80% 90%, 50% 100%, 20% 90%, 0% 70%, 0% 35%, 20% 10%)' }} 
                >
                  <span className="text-xs font-bold opacity-80">100%</span>
                  <span className="text-5xl font-black leading-none">مجاناً</span>
                  <span className="font-bold">مدى الحياة</span>
                </div>
              </div>
            </div>
            
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto">
              بدون أي رسوم خفية، أو شروط، فرصة مدى الحياة لبيع منتجاتك لأي مكان وتحقيق أحلامك!
            </p>
          </div>

          <div className="p-6 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-orange-500 to-purple-600 text-white font-bold py-4 rounded-xl text-lg hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/20 active:scale-95 flex items-center justify-center gap-2"
            >
              <span>إبدأ رحلة بيعك من اليوم</span>
              <ArrowLeft />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CongratsModal;
