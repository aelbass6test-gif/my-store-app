import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'success' | 'error';

interface GlobalSaveIndicatorProps {
  status: SaveStatus;
  message?: string;
}

const GlobalSaveIndicator: React.FC<GlobalSaveIndicatorProps> = ({ status, message }) => {
  if (status === 'idle') return null;

  const config = {
    pending: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    saving: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', spin: true },
    success: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' }
  }[status as Exclude<SaveStatus, 'idle'>];

  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className="fixed top-20 right-6 z-[100] pointer-events-none">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={`${config.bg} ${config.color} border border-current/20 px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 backdrop-blur-md`}
        >
          <Icon size={16} className={config.spin ? 'animate-spin' : ''} />
          <span className="text-xs font-black">{message || 'جاري الحفظ...'}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default GlobalSaveIndicator;
