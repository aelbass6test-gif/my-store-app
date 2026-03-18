import React from 'react';
import { Save, X, Edit3 } from 'lucide-react';

interface EditableFieldProps {
    icon: React.ReactNode;
    label: string;
    isEditing: boolean;
    onEdit?: () => void;
    onSave: () => void;
    onCancel?: () => void;
    editComponent: React.ReactNode;
    displayComponent: React.ReactNode;
    disabled?: boolean;
}

const EditableField: React.FC<EditableFieldProps> = ({
    icon,
    label,
    isEditing,
    onEdit,
    onSave,
    onCancel,
    editComponent,
    displayComponent,
    disabled = false
}) => {
    return (
        <div className="space-y-1">
            <label className="text-xs text-slate-500 flex items-center gap-1">
                {icon} {label}
            </label>
            {isEditing ? (
                <div className="flex items-start gap-2">
                    <div className="flex-1">
                        {editComponent}
                    </div>
                    <button onClick={onSave} className="p-2 bg-emerald-100 text-emerald-600 rounded-md shrink-0">
                        <Save size={16} />
                    </button>
                    {onCancel && (
                        <button type="button" onClick={onCancel} className="p-2 bg-slate-100 text-slate-600 rounded-md shrink-0">
                            <X size={16} />
                        </button>
                    )}
                </div>
            ) : (
                <div className="flex items-start justify-between">
                    <div className="flex-1 pl-4">
                        {displayComponent}
                    </div>
                    {onEdit && !disabled && (
                        <button onClick={onEdit} className="p-1 text-slate-400 hover:text-blue-500 shrink-0">
                            <Edit3 size={14} />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default EditableField;
