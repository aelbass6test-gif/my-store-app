import React, { useState, useEffect } from 'react';
import { Check, X, Edit2 } from 'lucide-react';

interface EditableFieldProps {
  value: string;
  onSave: (newValue: string) => void;
  className?: string;
  type?: string;
}

const EditableField: React.FC<EditableFieldProps> = ({ value, onSave, className = '', type = 'text' }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  const handleSave = () => {
    onSave(tempValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempValue(value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <input
          type={type}
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          className="flex-1 p-1 text-sm bg-white dark:bg-slate-800 border-2 border-primary rounded-md outline-none"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
        />
        <button onClick={handleSave} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded">
          <Check size={16} />
        </button>
        <button onClick={handleCancel} className="p-1 text-red-500 hover:bg-red-50 rounded">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className={`group flex items-center gap-2 cursor-pointer ${className}`} onClick={() => setIsEditing(true)}>
      <span>{value || '---'}</span>
      <Edit2 size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
};

export default EditableField;
