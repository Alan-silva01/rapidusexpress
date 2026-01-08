import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setShowBanner(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setShowBanner(false);
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('✅ PWA instalado com sucesso!');
        }

        setDeferredPrompt(null);
        setShowBanner(false);
    };

    const handleDismiss = () => {
        setShowBanner(false);
    };

    if (!showBanner) return null;

    return (
        <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up">
            <div className="bg-gradient-to-r from-orange-primary to-orange-600 rounded-2xl p-4 shadow-2xl flex items-center gap-4">
                <div className="bg-white/20 rounded-xl p-3">
                    <Download size={24} className="text-white" />
                </div>
                <div className="flex-1">
                    <p className="text-white font-bold text-sm">Instalar Rapidus</p>
                    <p className="text-white/80 text-xs">Acesse mais rápido pela tela inicial</p>
                </div>
                <button
                    onClick={handleInstall}
                    className="bg-white text-orange-primary font-bold px-4 py-2 rounded-xl text-sm active:scale-95 transition-transform"
                >
                    Instalar
                </button>
                <button
                    onClick={handleDismiss}
                    className="text-white/60 p-1"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
};

export default InstallPrompt;
