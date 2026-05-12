import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Loader2, Save, RefreshCw, CheckCircle } from 'lucide-react';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'success' | 'error';

interface GlobalSaveIndicatorProps {
  status: SaveStatus;
  message?: string;
  onRetry?: () => void;
}

const GlobalSaveIndicator: React.FC<GlobalSaveIndicatorProps> = ({ 
  status, 
  message,
  onRetry
}) => {
  if (status === 'idle') return null;

  const isError = status === 'error';
  const isSaving = status === 'saving';
  const isPending = status === 'pending';
  const isSuccess = status === 'success';

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        className="fixed top-20 right-4 z-[100]"
      >
        <button 
          onClick={onRetry}
          disabled={isSaving || isSuccess}
          className={`
            flex items-center gap-3 px-4 py-2 rounded-full shadow-lg border backdrop-blur-md transition-all active:scale-95 group
            ${isError 
              ? 'bg-rose-50/90 dark:bg-rose-900/90 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-800' 
              : isSaving 
              ? 'bg-indigo-50/90 dark:bg-indigo-900/90 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400'
              : isSuccess
              ? 'bg-emerald-50/90 dark:bg-emerald-900/90 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-50/90 dark:bg-amber-900/90 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-800'
            }
          `}
          title={isError ? 'إعادة محاولة الحفظ' : isPending ? 'حفظ الآن' : ''}
        >
          {isError ? (
            <AlertCircle size={16} className="flex-shrink-0" />
          ) : isSaving ? (
            <Loader2 size={16} className="animate-spin flex-shrink-0" />
          ) : isSuccess ? (
            <CheckCircle size={16} className="flex-shrink-0" />
          ) : (
            <Save size={16} className="flex-shrink-0 group-hover:scale-110 transition-transform" />
          )}
          
          <span className="text-[11px] font-black whitespace-nowrap">
            {message || (isError ? 'فشل الحفظ!' : isSaving ? 'جاري الحفظ...' : isSuccess ? 'تم الحفظ بنجاح' : 'تغييرات غير محفوظة...')}
          </span>

          {(isError || isPending) && (
             <div className={`
               px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 transition-colors
               ${isError ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'}
             `}>
               {isError ? (
                 <>
                   <RefreshCw size={10} />
                   <span>إعادة المحاولة</span>
                 </>
               ) : (
                 'حفظ الآن'
               )}
             </div>
          )}

          {isPending && (
             <motion.div
               animate={{ scale: [1, 1.2, 1] }}
               transition={{ repeat: Infinity, duration: 2 }}
               className="w-1.5 h-1.5 rounded-full bg-amber-500"
             />
          )}
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default GlobalSaveIndicator;
