import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, CheckCircle, AlertTriangle, Save } from 'lucide-react';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'success' | 'error';

interface GlobalSaveIndicatorProps {
  status: SaveStatus;
  message: string;
}

const GlobalSaveIndicator: React.FC<GlobalSaveIndicatorProps> = ({ status, message }) => {
  const config: any = {
    pending: { icon: <Save size={16} className="text-slate-500 dark:text-slate-400" /> },
    saving: { icon: <Loader2 size={16} className="animate-spin text-blue-500" /> },
    success: { icon: <CheckCircle size={16} className="text-emerald-500" /> },
    error: { icon: <AlertTriangle size={16} className="text-red-500" /> },
  };

  const current = config[status];
  const shouldShow = status === 'saving' || status === 'success' || status === 'error';

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[200]">
      <AnimatePresence>
        {shouldShow && current && (
          <motion.div
            key={status}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700"
          >
            {current.icon}
            <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GlobalSaveIndicator;
