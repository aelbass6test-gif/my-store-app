import React from 'react';
import { Save, X } from 'lucide-react';

interface SaveBarProps {
  isVisible: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

const SaveBar: React.FC<SaveBarProps> = ({ isVisible, onSave, onDiscard }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-300">
      <div className="container mx-auto px-6 py-4">
        <div className="bg-slate-800 text-white p-4 rounded-xl shadow-2xl flex items-center justify-between">
          <span className="font-bold">لديك تغييرات غير محفوظة!</span>
          <div className="flex items-center gap-3">
            <button
              onClick={onDiscard}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg font-bold text-sm flex items-center gap-2"
            >
              <X size={16} />
              تجاهل
            </button>
            <button
              onClick={onSave}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold text-sm flex items-center gap-2"
            >
              <Save size={16} />
              حفظ التغييرات
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaveBar;
