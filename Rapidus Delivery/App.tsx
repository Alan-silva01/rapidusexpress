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
        if (event === 'SIGNED_IN') setCurrentView('dashboard');
        fetchProfile(session.user.id);
      }
      else {
        setProfile(null);
        setCurrentView('dashboard');
        setLoading(false);
      }
    });
    authSubscription = subscription;

    return () => authSubscription?.unsubscribe();
  }, []);

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
