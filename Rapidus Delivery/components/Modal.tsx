import React from 'react';
import ReactDOM from 'react-dom';
import { X, CheckCircle2, AlertTriangle, Info, Bike, UserCheck } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    type?: 'success' | 'warning' | 'info' | 'driver' | 'admin';
    title: string;
    message: string;
    primaryAction?: {
        label: string;
        onClick: () => void;
    };
    secondaryAction?: {
        label: string;
        onClick: () => void;
    };
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    type = 'info',
    title,
    message,
    primaryAction,
    secondaryAction
}) => {
    if (!isOpen) return null;

    const iconMap = {
        success: <CheckCircle2 size={32} className="text-lime-500" />,
        warning: <AlertTriangle size={32} className="text-orange-primary" />,
        info: <Info size={32} className="text-blue-400" />,
        driver: <Bike size={32} className="text-orange-primary" />,
        admin: <UserCheck size={32} className="text-orange-primary" />
    };

    const bgColorMap = {
        success: 'bg-lime-500/10',
        warning: 'bg-orange-primary/10',
        info: 'bg-blue-400/10',
        driver: 'bg-orange-primary/10',
        admin: 'bg-orange-primary/10'
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 animate-fade">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-sm glass-card rounded-[2rem] p-8 border border-white/10 shadow-2xl z-10">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-600 hover:text-white transition-colors"
                >
                    <X size={16} />
                </button>

                {/* Icon */}
                <div className={`w-16 h-16 ${bgColorMap[type]} rounded-2xl flex items-center justify-center mx-auto mb-6`}>
                    {iconMap[type]}
                </div>

                {/* Title */}
                <h2 className="text-lg font-black text-white text-center uppercase tracking-tight mb-2">
                    {title}
                </h2>

                {/* Message */}
                <p className="text-[11px] text-gray-400 text-center leading-relaxed mb-8">
                    {message}
                </p>

                {/* Actions */}
                <div className="space-y-3">
                    {primaryAction && (
                        <button
                            onClick={primaryAction.onClick}
                            className="w-full h-14 bg-orange-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-orange-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
                        >
                            {primaryAction.label}
                        </button>
                    )}
                    {secondaryAction && (
                        <button
                            onClick={secondaryAction.onClick}
                            className="w-full h-12 bg-white/5 text-gray-400 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                        >
                            {secondaryAction.label}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default Modal;
