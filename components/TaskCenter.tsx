
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, AlertCircle, X, ChevronDown, ChevronUp, Layers, Zap } from 'lucide-react';
import { BackgroundTask } from '../types';

interface TaskCenterProps {
  tasks: BackgroundTask[];
  onDismiss: (taskId: string) => void;
}

const TaskCenter: React.FC<TaskCenterProps> = ({ tasks, onDismiss }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const activeTasks = tasks.filter(t => t.status === 'running' || t.status === 'pending');
  const hasActiveTasks = activeTasks.length > 0;

  if (tasks.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-6 z-[60] flex flex-col items-start gap-3">
      {/* Summary Floating Button */}
      {!isExpanded && hasActiveTasks && (
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={() => setIsExpanded(true)}
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none flex items-center gap-3 hover:bg-indigo-700 transition-all font-bold text-sm"
        >
          <Loader2 size={18} className="animate-spin" />
          <span>جاري تنفيذ {activeTasks.length} مهام...</span>
          <ChevronUp size={16} />
        </motion.button>
      )}

      {/* Expanded Task List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ y: 50, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.9 }}
            className="w-80 max-w-[90vw] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-indigo-500" />
                <h3 className="font-black text-sm text-slate-800 dark:text-slate-200">مركز المهام</h3>
              </div>
              <button 
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
              >
                <ChevronDown size={18} className="text-slate-500" />
              </button>
            </div>

            <div className="p-2 max-h-[400px] overflow-y-auto no-scrollbar space-y-2">
              {tasks.map(task => (
                <div 
                  key={task.id} 
                  className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-700/50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {task.status === 'running' && <Loader2 size={14} className="animate-spin text-indigo-500" />}
                      {task.status === 'completed' && <CheckCircle2 size={14} className="text-emerald-500" />}
                      {task.status === 'failed' && <AlertCircle size={14} className="text-rose-500" />}
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{task.name}</span>
                    </div>
                    {task.status !== 'running' && (
                      <button onClick={() => onDismiss(task.id)} className="text-slate-400 hover:text-rose-500 p-0.5">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  
                  <p className="text-[10px] text-slate-500 mb-2 truncate">{task.description}</p>
                  
                  {task.status === 'running' && (
                    <div className="space-y-1">
                      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-indigo-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${task.progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                        <span>{task.progress}% مكتمل</span>
                        <span className="animate-pulse">جاري التنفيذ...</span>
                      </div>
                    </div>
                  )}

                  {task.status === 'completed' && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">تم الانتهاء بنجاح</p>
                  )}

                  {task.status === 'failed' && (
                    <p className="text-[10px] text-rose-500 font-bold">خطأ: {task.error || 'حدث خطأ غير متوقع'}</p>
                  )}
                </div>
              ))}
            </div>

            {tasks.length > 5 && (
                 <div className="p-3 text-center border-t border-slate-100 dark:border-slate-800">
                    <button 
                        onClick={() => tasks.filter(t => t.status !== 'running').forEach(t => onDismiss(t.id))}
                        className="text-[10px] font-black text-slate-400 hover:text-rose-500"
                    >
                        مسح كافة المهام المكتملة
                    </button>
                 </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TaskCenter;
