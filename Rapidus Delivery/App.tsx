import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Perfil } from './types';
import Login from './views/Login';
import AdminDashboard from './views/AdminDashboard';
import DriverDashboard from './views/DriverDashboard';
import DeliveriesInbox from './views/DeliveriesInbox';
import Profile from './views/Profile';
import Finance from './views/Finance';
import MapView from './views/MapView';
import DriverManagement from './views/DriverManagement';
import { Layout } from './components/Layout';

import DeliveriesHistory from './views/DeliveriesHistory';
import PriceTables from './views/PriceTables';
import NotificationManager from './utils/NotificationManager';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'inbox' | 'profile' | 'finance' | 'map' | 'drivers' | 'new_client' | 'self_delivery' | 'history' | 'prices'>('dashboard');
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'searching' | 'active' | 'denied' | 'error'>('idle');

  useEffect(() => {
    let authSubscription: any;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
      }
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        if (event === 'SIGNED_IN') {
          setCurrentView('dashboard');
          NotificationManager.requestPermission();
        }
        fetchProfile(session.user.id);
      }
      else {
        setProfile(null);
        setCurrentView('dashboard');
        setLoading(false);
      }
    });
    authSubscription = subscription;

    // Listener Realtime Global para Entregas e Clientes (n8n)
    const channel = supabase
      .channel('global_delivery_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entregas' }, (payload) => {
        handleRealtimeEvent(payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, (payload) => {
        // Quando o clientes (n8n) muda, notificamos o admin
        if (profile?.funcao === 'admin') {
          handleRealtimeEvent({ ...payload, isFromClients: true });
        }
      })
      .subscribe();

    return () => {
      authSubscription?.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRealtimeEvent = (payload: any) => {
    const newData = payload.new as any;
    const oldData = payload.old as any;

    // Caso especial: n8n atualizando a tabela clientes
    if (payload.isFromClients) {
      if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
        NotificationManager.notify(
          '🔔 Pedido n8n Recebido!',
          'Uma nova entrega foi injetada via n8n. Verifique sua Inbox.',
          '/inbox'
        );
      }
      return;
    }

    // Nova Entrega - sempre notificar com som
    if (payload.eventType === 'INSERT' && newData?.status === 'pendente') {
      NotificationManager.notify(
        '🚀 Novo Pedido Recebido!',
        'Um estabelecimento acabou de enviar um novo pedido de entrega.',
        '/inbox'
      );
      return;
    }

    // Lógica específica que depende do profile
    if (!profile) return;

    if (payload.eventType === 'INSERT') {
      // Nova Entrega (Som para Admin)
      if (profile.funcao === 'admin' && newData.status === 'pendente') {
        // Já notificado acima
      }
    } else if (payload.eventType === 'UPDATE') {
      // Entrega Atribuída (Som para Entregador)
      if (profile.funcao === 'entregador' &&
        newData.entregador_id === profile.id &&
        oldData.status === 'pendente' &&
        newData.status === 'atribuida') {
        NotificationManager.notify(
          '📦 Nova Entrega Atribuída!',
          'Você recebeu uma nova entrega! Clique para aceitar.',
          '/dashboard'
        );
      }

      // Entrega Recusada ou Aceita (Notificar Admin)
      if (profile.funcao === 'admin' && newData.status !== oldData.status) {
        const msg = newData.status === 'aceita' ? 'Um motorista aceitou o pedido!' : `Status alterado para: ${newData.status}`;
        NotificationManager.notify('Atualização de Entrega', msg);
      }
    }
  };

  useEffect(() => {
    let watchId: number;

    const startTracking = async () => {
      if (!navigator.geolocation) {
        setGpsStatus('error');
        return;
      }

      if (session?.user?.id) {
        console.log('Rastreador: Ligando GPS para', session.user.id);
        setGpsStatus('searching');

        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            console.log('GPS: Fix inicial obtido', latitude, longitude);
            setGpsStatus('active');
            await supabase.from('perfis').update({ latitude, longitude }).eq('id', session.user.id);
            setProfile(prev => prev ? { ...prev, latitude, longitude } : null);
          },
          (err) => {
            console.warn('GPS: Erro no fix inicial', err.code, err.message);
            // Se já temos a posição na memória ou no estado, ignoramos o erro visual
            if (profile?.latitude || gpsStatus === 'active') {
              setGpsStatus('active');
              return;
            }
            if (err.code === 1) setGpsStatus('denied');
            else setGpsStatus('error');
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );

        watchId = navigator.geolocation.watchPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            console.log('GPS: Atualização recebida', latitude, longitude);
            setGpsStatus('active');
            await supabase.from('perfis').update({ latitude, longitude }).eq('id', session.user.id);
            setProfile(prev => prev ? { ...prev, latitude, longitude } : null);
          },
          (err) => {
            console.warn('GPS: Erro no watch', err.code, err.message);

            // Se for timeout (3) mas já temos posição, mantemos 'active'
            if (err.code === 3 && (profile?.latitude || gpsStatus === 'active')) {
              setGpsStatus('active');
              return;
            }

            if (err.code === 1) setGpsStatus('denied');
            else setGpsStatus('error');
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
        );
      }
    };

    startTracking();

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [session?.user?.id]);

  /* 
  // Disable Auto-Subscription - relying on Manual Activation in Profile to prevent overwrites
  useEffect(() => {
    if (profile && 'serviceWorker' in navigator && 'PushManager' in window) {
      // setupNotifications();
    }
  }, [profile?.id]);
  */

  // Handle Deep Linking (Push Click)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if ((viewParam === 'inbox' || window.location.hash === '#inbox') && session) {
      console.log('🔗 Deep Link Detected: Inbox');
      setCurrentView('inbox');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [session]);

  // Smart Auto-Sync Notification Logic (V2 - Aggressive Wake-up)
  const setupNotifications = async () => {
    try {
      console.log('🔔 Push Setup: Starting check...');
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('🔔 Push Setup: Browser not supported');
        return;
      }
      if (Notification.permission !== 'granted') {
        console.log('🔔 Push Setup: Permission not granted');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      console.log('🔔 Push Setup: SW ready');

      // AGGRESSIVE WAKE-UP: Force SW update check to ensure it's responsive
      try {
        await registration.update();
        console.log('🔔 Push Setup: SW updated/refreshed');
      } catch (updateErr) {
        console.warn('🔔 Push Setup: SW update check failed (non-fatal)', updateErr);
      }

      const VAPID_PUBLIC_KEY = 'BAfEBFOtIe1ByawG9QhfIlKSL2XNbEnjSn0HtJYIyuMtmQdgykJAxRT9CSQuBuPORnJVGv6rwOgd2QEPpEzH85c';

      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
        return outputArray;
      };

      let subscription = await registration.pushManager.getSubscription();
      console.log('🔔 Push Setup: Existing subscription?', !!subscription);

      // AUTO-RESUBSCRIBE if subscription is missing
      if (!subscription) {
        console.log('🔔 Push Setup: No subscription found, attempting silent subscribe...');
        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
          });
          console.log('🔔 Push Setup: Silent subscribe SUCCESS');
        } catch (e) {
          console.error('🔔 Push Setup: Silent subscribe FAILED', e);
          return;
        }
      }

      if (subscription && profile?.id) {
        // Check DB value first to avoid unnecessary overwrite risk
        const { data: currentDb } = await supabase
          .from('perfis')
          .select('push_token')
          .eq('id', profile.id)
          .single();

        const localStr = JSON.stringify(subscription);
        const remoteStr = typeof currentDb?.push_token === 'string'
          ? currentDb.push_token
          : JSON.stringify(currentDb?.push_token);

        // Compare endpoints primarily because expirationTime changes often
        let localEndpoint = '';
        let remoteEndpoint = '';
        try {
          localEndpoint = JSON.parse(localStr).endpoint;
          remoteEndpoint = remoteStr ? JSON.parse(remoteStr).endpoint : '';
        } catch (parseErr) {
          console.warn('🔔 Push Setup: Parse error, will force sync', parseErr);
        }

        // SYNC if endpoints differ OR if remote is empty/null
        if (localEndpoint !== remoteEndpoint || !remoteEndpoint) {
          console.log('🔄 Push Setup: Syncing token to DB...');
          await supabase.from('perfis').update({
            push_token: localStr
          }).eq('id', profile.id);
          console.log('✅ Push Setup: Token Synced Successfully');
        } else {
          console.log('✅ Push Setup: Token is Active & Valid (no sync needed)');
        }
      }
    } catch (err) {
      console.error('🔔 Push Setup: Fatal Error', err);
    }
  };

  useEffect(() => {
    if (session && profile) {
      setupNotifications();
    }
  }, [session, profile?.id]);


  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('perfis').select('*').eq('id', userId).single();
      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setCurrentView('dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t border-orange-primary"></div>
      </div>
    );
  }

  if (!session) return <Login />;

  const renderContent = () => {
    if (!profile) return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-orange-primary/10 rounded-2xl flex items-center justify-center text-orange-primary mb-6">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">Perfil não encontrado</h2>
        <p className="text-xs text-gray-500 mb-8 max-w-xs leading-relaxed">Não conseguimos carregar suas informações de acesso. Tente entrar novamente.</p>
        <button
          onClick={handleLogout}
          className="px-8 h-12 bg-white/5 border border-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
        >
          Sair e Tentar de Novo
        </button>
      </div>
    );
    switch (currentView) {
      case 'dashboard':
        return profile.funcao === 'admin' ? <AdminDashboard onViewChange={setCurrentView} profile={profile} /> : <DriverDashboard profile={profile} onViewChange={setCurrentView} />;
      case 'inbox':
        return <DeliveriesInbox onAssignSuccess={setCurrentView} profile={profile} />;
      case 'profile':
        return <Profile profile={profile} onUpdate={() => fetchProfile(profile.id)} onLogout={handleLogout} />;
      case 'finance':
        return <Finance profile={profile} />;
      case 'map':
        return <MapView profile={profile} gpsStatus={gpsStatus} />;
      case 'drivers':
        return <DriverManagement />;
      case 'new_client':
        return <AdminDashboard onViewChange={setCurrentView} profile={profile} showNewClientForm={true} />;
      case 'self_delivery':
        // No modo 'self_delivery', o Admin vê a mesma interface do entregador
        return <DriverDashboard profile={profile} onViewChange={setCurrentView} />;
      case 'history':
        return <DeliveriesHistory profileId={profile.id} onBack={() => setCurrentView('dashboard')} />;
      case 'prices':
        return <PriceTables onBack={() => setCurrentView('dashboard')} />;
      default:
        return <AdminDashboard onViewChange={setCurrentView} profile={profile} />;
    }
  };

  return (
    <Layout
      role={profile?.funcao || 'entregador'}
      currentView={currentView}
      onViewChange={setCurrentView}
      onLogout={handleLogout}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
