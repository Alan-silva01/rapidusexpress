// Utilitário para gerenciar notificações e sons
class NotificationManager {
    private static audio: HTMLAudioElement | null = null;
    private static audioUnlocked: boolean = false;

    // Base64 de um som de "ding/bell" curto
    private static readonly DING_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleCAFVrrG5oUqBBEu3e7l0JlsNkxPn9DTm4yGiH6Ch46Kh4+UjIaFgoaHhIN8eoGIjpOWnJqUjoiFhoqKi4qGgn9+f4GFipGXnJualI6HhIWHiYuMi4iFgn99foCDh42SmZuampWQi4eEhYeIiYqJh4V/e3p7fYGGjJKXm5ubl5KNiYaEhIWGh4iHhYJ+enl5e36Dh4yRlpmam5mVkYyIhYOCg4SEhYWEgX15d3d4e3+DiIyQlJeYmZiWko6KhoOBgIGCgoODgn96dnRzdXh8gIWJjZGVl5iYl5WRjoqGg4CAgICBgYGAfXl1c3JzdnqAhImNkZSXmJiXlZKOioaCf35+f3+AgH98eHVycHFzeH2Bg4iMj5OWl5iXlZKOioaCf31+fn5/f356dnJwb3BzeHuBhIiLj5KVlpeXlZKOioeCf31+fn9/fnt5dXBubm5weHuAg4eKjZCTlZaWlpSRjYmGgn99fX5+fnt5dHBubW1vc3h7gIOGiYyPkpSVlZWTkY2JhYJ/fHx9fXt6dnNvam1tb3N2e3+Cg4eJjI+Rk5SVlJORjomGgn98e3t7enl2cXBramxtcXV5fYCDhoiLjpCSlJSUkpCNiYWCf3t7e3t6eHVxbGpqa25xdXl8gIOGh4qNj5GSlJSTko+MiISBfnp6ent5d3RwbWhnanBydXl8f4KFh4mMjpCSk5OTkY+MiIWBfnp4eHl4dnRwcGxpampsb3R3e36Ch4mKjI2QkZKSkpCOi4eEgX14dnZ2dXRycG5sb2xxdHZ6fYCDhYeJjI6PkJGRkI+NioeEgH54dXV1dHRwb21rbXBzdnh7foCChoiLjY6QkZGRj46MiIWCf3t3dXR0dHNybm1tb3Byc3R4e36Bg4WIiouNj5CQkI+Oi4iEgX54dXR0dHNybm5ucHJzdHV4e36AgoSHiYuMjY+Pj4+OjYqHg4B9eHV0dHRzcm9vb3Bzc3R1eHt9gIKEhoiKjI2Oj4+PjoyKh4OAfXh1dHRzdHFwcHBxc3N0dXl7fYCBg4aHiYuMjY6Pj46NioeDgH14dXR0dHRxcHFxcnNzdXZ5e32AgYOFh4mLjY6Ojo6NjIqHg4B9eHZ0dHRzcnFxcXJzdHV3eXt9gIGDhYeJi4yNjo6OjYyKhoN/fHl2dHR0dHJxcXFyc3R1d3l7fYB/goSGiImLjI2NjY2MioeDgH14dnR0dHRyc3FxcnN0dXd5e32AgIGEhoiJiouMjIyMi4qHhIB9eXZ0c3R0dHNycnJzdHR2eHp8foCAgoSGhomKi4uLi4qJh4SDgHx4dnR0dHRzdHNzcnN0dXZ4ent9f4GDhIaIiIqKioqKiYiGhIKAfHl2dHR0dHRzdHN0dHV1d3l6fH6AgIKEhoeIiYqJiYmIhoSCf3x4dnR0dHRzdHRzdHR1dnd5eXx+gIGDhYeHiIqJiYmIhoSCf3x5dnV0dHR0dHR0dHR1dnd5e3x+gIGDhIaHiImJiYiHhoOBfnx5d3V0dHR0dHR0dHR1d3h5e3x+f4GDhIaHiIiIiIeGhYKAfXt5dnV0dHR0dHR0dXV2d3l6fH+AgYOEhoaHiIiHhoWDgX58enl2dXV0dHR1dXV2eHl6fH2Bf4GCg4WGhoeHh4aEg4F+fHp4dnV1dHV1dXZ2d3h5ent9f4GBg4WGhoeHhoWEgoB+fHp4dXV0dXV1dXZ2eHl5e31/gIGCg4WFhoaGhYSDgX99enl2dXV0dHV1dnd4eHl6fH6AgIKDhIWFhYWEg4KAfXt5eHd2dXV1dXZ2d3h5enp8fn+AgoOEhIWFhYSEgoB+fHp4d3Z2dXV2dnd3eXl6e31/f4GCg4SEhIODg4F/fnt4d3Z1dXZ1dnd3eHl6e31+f4GBgoODhIODgoF/fHt4d3Z2dXV2dnd3eHp6e31+f4CBgoKDg4KCgYB+fHt5d3Z2dXV2d3d4eHl6e35/f4GBgoKCgoKBf359e3l4d3Z2dXZ2d3h4eXt8fX5/gICBgoKCgYB/fn18e3l3d3Z2dnd3eHl5e3x9fn+BgYGBgoKBgH9+fXx6eXh3dnZ3d3h4eXp7fH1+f4CAgoKCgH9/fXx7eXh3d3Z2d3h4eXp6e3x9f4CAgIKBgIB/fnx7eXh3d3d3d3h4eXl6e3x+f4CAgoGBf35+fHt6eXd3dnd4eHl5enp7fX5/gICBgYB/fn18e3p4d3d3d3d4eXl5e3x9fn+AgoGAgH9+fXx7eXh3d3d4d3h5eXt8fX5/gICBgIB/fn18e3l4d3d3d3h5enp8fX5/gIGBgIB/fXx7enhAQEAgQEBA';

    public static async notify(title: string, body: string, url: string = '/') {
        console.log('🔔 NotificationManager.notify chamado:', title);

        // 1. Som - sempre tentar tocar
        this.playNotificationSound();

        // 2. Notificação Visual (Browser)
        if ('Notification' in window) {
            console.log('🔔 Notification permission:', Notification.permission);
            if (Notification.permission === 'granted') {
                try {
                    const notification = new Notification(title, {
                        body,
                        icon: '/icons/icon-192.jpg',
                        badge: '/icons/icon-192.jpg',
                        vibrate: [200, 100, 200],
                        tag: 'delivery-notification',
                        requireInteraction: true
                    } as any);

                    notification.onclick = () => {
                        window.focus();
                        notification.close();
                    };
                    console.log('🔔 Notificação visual criada');
                } catch (err) {
                    console.warn('🔔 Erro ao criar notificação:', err);
                }
            } else if (Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                console.log('🔔 Permissão solicitada:', permission);
            }
        }
    }

    public static playNotificationSound() {
        console.log('🔊 Tentando tocar som de notificação');
        try {
            if (!this.audio) {
                this.audio = new Audio(this.DING_SOUND);
                this.audio.volume = 1.0;
            }
            this.audio.currentTime = 0;

            const playPromise = this.audio.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => console.log('🔊 Som tocado com sucesso'))
                    .catch(e => {
                        console.warn('🔊 Audio auto-play blocked:', e.message);
                    });
            }
        } catch (err) {
            console.warn('🔊 Notification sound failed:', err);
        }
    }

    public static unlockAudio() {
        if (this.audioUnlocked) return;
        try {
            if (!this.audio) {
                this.audio = new Audio(this.DING_SOUND);
            }
            this.audio.volume = 0;
            this.audio.play().then(() => {
                this.audio!.pause();
                this.audio!.volume = 1.0;
                this.audioUnlocked = true;
                console.log('🔊 Audio desbloqueado');
            }).catch(() => { });
        } catch (err) { }
    }

    public static async requestPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            console.log('🔔 Permissão de notificação:', permission);
            return permission === 'granted';
        }
        return false;
    }
}

export default NotificationManager;
