
import React, { useEffect, useState, useRef } from 'react';
import { MapPin, Navigation, Info, Search, Crosshair, Loader2 } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../supabase';
import { Perfil } from '../types';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

interface MapViewProps {
  profile: Perfil;
  gpsStatus: 'idle' | 'searching' | 'active' | 'denied' | 'error';
}

const MapView: React.FC<MapViewProps> = ({ profile: currentUser, gpsStatus }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [profiles, setProfiles] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [tokenError, setTokenError] = useState(false);
  const hasInitialFlyTo = useRef(false);

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    if (!token) {
      setTokenError(true);
      setLoading(false);
      return;
    }

    fetchInitialPositions();

    // Subscribe to REALTIME positions
    const channel = supabase
      .channel('map_tracking')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'perfis' }, (payload) => {
        const updatedProfile = payload.new as Perfil;
        if (updatedProfile.latitude && updatedProfile.longitude) {
          setProfiles(prev => {
            const exists = prev.find(p => p.id === updatedProfile.id);
            if (exists) {
              return prev.map(p => p.id === updatedProfile.id ? updatedProfile : p);
            }
            return [...prev, updatedProfile];
          });
          // updateMarker será chamado pelo useEffect de profiles
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (map.current) map.current.remove();
    };
  }, []);

  // Sincronizar marcadores quando a lista de perfis mudar
  useEffect(() => {
    if (!map.current) return;
    profiles.forEach(p => updateMarker(p));
    // Garantir que você sempre tenha um marcador
    if (currentUser.latitude && currentUser.longitude) {
      updateMarker(currentUser);
    }
  }, [profiles, currentUser.latitude, currentUser.longitude]);

  // Efeito para centralizar no usuário APENAS UMA VEZ ao carregar
  useEffect(() => {
    if (map.current && currentUser.latitude && currentUser.longitude && !hasInitialFlyTo.current) {
      console.log('Radar: Centralizando no usuário pela primeira vez');
      map.current.flyTo({
        center: [currentUser.longitude, currentUser.latitude],
        zoom: 15
      });
      hasInitialFlyTo.current = true;
    }
  }, [currentUser.latitude, currentUser.longitude]);

  const fetchInitialPositions = async () => {
    try {
      const { data, error } = await supabase.from('perfis').select('*').not('latitude', 'is', null);
      if (error) throw error;

      const profilesData = data || [];
      setProfiles(profilesData);
      initMap(profilesData);
    } catch (err) {
      console.error('Erro ao carregar posições:', err);
      initMap([]);
    } finally {
      setLoading(false);
    }
  };

  const initMap = (initialProfiles: Perfil[]) => {
    if (!mapContainer.current || map.current) return;

    let center: [number, number] = [-47.5028, -4.9547];
    if (currentUser.latitude && currentUser.longitude) {
      center = [currentUser.longitude, currentUser.latitude];
    } else if (initialProfiles.length > 0 && initialProfiles[0].longitude) {
      center = [initialProfiles[0].longitude, initialProfiles[0].latitude!];
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: center,
      zoom: currentUser.latitude ? 15 : 13,
      attributionControl: false
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    initialProfiles.forEach(profile => updateMarker(profile));
    if (currentUser.latitude && currentUser.longitude) {
      updateMarker(currentUser);
    }
  };

  const updateMarker = (profile: Perfil) => {
    if (!map.current || !profile.latitude || !profile.longitude) return;

    const isYou = profile.id === currentUser.id;
    const bgColor = profile.funcao === 'admin' ? '#FF5C00' : '#84CC16';
    const markerHtml = `
      <div class="flex flex-col items-center">
        <div class="p-1.5 rounded-xl border-2 shadow-2xl border-black text-white" style="background-color: ${bgColor}">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div class="mt-2 px-3 py-1 bg-black/80 backdrop-blur-md rounded-lg border border-white/5 whitespace-nowrap">
          <p class="text-[9px] font-black text-white uppercase">${profile.nome} ${isYou ? '<span class="text-orange-primary ml-1">(VOCÊ)</span>' : ''}</p>
        </div>
      </div>
    `;

    if (markers.current[profile.id]) {
      const marker = markers.current[profile.id];
      marker.setLngLat([profile.longitude, profile.latitude]);
      marker.getElement().innerHTML = markerHtml;
    } else {
      const el = document.createElement('div');
      el.className = 'marker';
      el.innerHTML = markerHtml;

      const marker = new mapboxgl.Marker(el)
        .setLngLat([profile.longitude, profile.latitude])
        .addTo(map.current);
      markers.current[profile.id] = marker;
    }
  };

  const centerOnUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        map.current?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 15
        });
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade h-[calc(100vh-160px)] flex flex-col">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black uppercase tracking-tighter">Radar Rapidus</h1>
          <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Açailândia • MA</p>
        </div>
        <div className="flex gap-2">
          <button className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center text-gray-500">
            <Info size={16} />
          </button>
          <button
            onClick={centerOnUser}
            className="w-9 h-9 bg-orange-primary/10 rounded-xl flex items-center justify-center text-orange-primary"
          >
            <Crosshair size={16} />
          </button>
        </div>
      </header>

      <div className="flex-1 relative bg-[#050505] rounded-[2.5rem] border border-white/5 overflow-hidden">
        {tokenError && (
          <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mb-6">
              <Info size={32} />
            </div>
            <h2 className="text-white font-black uppercase tracking-tight mb-2">Erro de Configuração</h2>
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs">
              O token do Mapbox não foi encontrado. Verifique o arquivo .env.local e reinicie o servidor.
            </p>
          </div>
        )}

        {loading && !tokenError && (
          <div className="absolute inset-0 z-10 bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="animate-spin text-orange-primary" size={32} />
          </div>
        )}
        <div ref={mapContainer} className="w-full h-full" />

        {/* HUD de Informação de Mapa */}
        <div className="absolute bottom-6 left-6 right-6 pointer-events-none">
          <div className="glass-card p-4 rounded-3xl flex items-center justify-between border-orange-primary/10 pointer-events-auto">
            <div className="flex items-center gap-4">
              {/* Novo Indicador de GPS no Mapa */}
              <div className={`flex items-center gap-2 px-2 py-0.5 rounded-full border transition-all duration-500 ${gpsStatus === 'active' ? 'bg-lime-500/10 border-lime-500/20 text-lime-500' :
                gpsStatus === 'searching' ? 'bg-orange-primary/10 border-orange-primary/20 text-orange-primary animate-pulse' :
                  gpsStatus === 'denied' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                    'bg-white/5 border-white/10 text-gray-500'
                }`}>
                <div className={`w-1 h-1 rounded-full ${gpsStatus === 'active' ? 'bg-lime-500 shadow-[0_0_5px_rgba(132,204,22,0.5)]' :
                  gpsStatus === 'searching' ? 'bg-orange-primary shadow-[0_0_5px_rgba(255,92,0,0.5)]' :
                    gpsStatus === 'denied' ? 'bg-red-500' :
                      'bg-gray-500'
                  }`} />
                <span className="text-[7px] font-black uppercase tracking-widest leading-none">
                  {gpsStatus === 'active' ? 'GPS OK' :
                    gpsStatus === 'searching' ? 'BUSCANDO...' :
                      gpsStatus === 'denied' ? 'BLOQUEADO' :
                        gpsStatus === 'error' ? 'ERRO' : 'INATIVO'}
                </span>
              </div>

              <div className="w-px h-3 bg-white/10" />

              <div className="flex items-center gap-2 text-gray-400">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-primary animate-pulse"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Radar ON</span>
              </div>
            </div>
            <p className="text-[10px] font-black uppercase text-orange-primary tracking-widest">{profiles.length} Online</p>
          </div>
        </div>
      </div>

      <style>{`
        .mapboxgl-ctrl-bottom-left, .mapboxgl-ctrl-bottom-right { display: none !important; }
        .marker { cursor: pointer; }
      `}</style>
    </div>
  );
};

export default MapView;
