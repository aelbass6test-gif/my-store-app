import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'success' | 'error';

interface GlobalSaveIndicatorProps {
  status: SaveStatus;
  message: string;
}

const GlobalSaveIndicator: React.FC<GlobalSaveIndicatorProps> = ({ status, message }) => {
  // If idle, render nothing
  if (status === 'idle') return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none" dir="ltr">
      {/* Container for the progress bar */}
      <div className="h-[3px] w-full bg-transparent relative overflow-hidden">
        
        {/* Pending State: Amber indicator showing unsaved changes exist */}
        {status === 'pending' && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '15%', opacity: 1 }}
            className="absolute top-0 left-0 h-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]"
          />
        )}

        {/* Saving State: Continuous Indeterminate Blue Animation */}
        {status === 'saving' && (
          <div className="absolute top-0 left-0 w-full h-full bg-indigo-100/20">
             <motion.div 
                className="h-full bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.6)]"
                initial={{ x: "-100%", width: "50%" }}
                animate={{ x: "200%" }}
                transition={{ 
                    repeat: Infinity, 
                    duration: 1.5, 
                    ease: "linear" 
                }}
             />
          </div>
        )}

        {/* Success State: Full Green Bar */}
        {status === 'success' && (
          <motion.div 
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute top-0 left-0 h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]"
          />
        )}

        {/* Error State: Full Red Bar */}
        {status === 'error' && (
          <motion.div 
            initial={{ width: '100%' }}
            animate={{ width: '100%' }}
            className="absolute top-0 left-0 h-full bg-red-600"
          />
        )}
      </div>

      {/* Error Message Toast (Only shown on error) */}
      <AnimatePresence>
        {status === 'error' && (
            <div className="flex justify-center mt-4">
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-red-100 text-red-700 px-6 py-3 rounded-xl text-sm font-bold border border-red-200 shadow-xl flex items-center gap-2 backdrop-blur-sm pointer-events-auto"
                >
                    <span>⚠️ {message}</span>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GlobalSaveIndicator;