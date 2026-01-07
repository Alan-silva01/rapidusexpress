import React, { useState, useEffect } from 'react';
import { Banner } from '../components/Banner';
import { TrendingUp, Users, Package, Bell, Search, Plus, ChevronRight, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';
import { Perfil } from '../types';
import NewClientForm from './NewClientForm';

interface AdminDashboardProps {
  onViewChange: (view: any) => void;
  profile?: Perfil | null;
  showNewClientForm?: boolean;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onViewChange, profile, showNewClientForm }) => {
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'info' | 'alert' } | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Estados de Filtro
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDriver, setFilterDriver] = useState<string>('all');
  const [filterStore, setFilterStore] = useState<string>('all');
  const [filterSearch, setFilterSearch] = useState<string>('');

  // Listas para os Selects
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [availableStores, setAvailableStores] = useState<any[]>([]);

  useEffect(() => {
    fetchFilterData();
    fetchRecentActivities();

    const channel = supabase
      .channel('admin_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entregas' }, (payload) => {
        fetchRecentActivities();
        const newData = payload.new as any;
        if (payload.eventType === 'UPDATE') {
          if (newData.status === 'finalizada') {
            showNotification('Entrega Concluída!', 'success');
          } else if (newData.status === 'em_rota') {
            showNotification('Um entregador aceitou um pedido!', 'info');
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterStatus, filterDriver, filterStore, filterSearch]);

  const fetchFilterData = async () => {
    const { data: stores } = await supabase.from('estabelecimentos').select('id, nome').order('nome');
    // Buscar tanto admins quanto entregadores, pois ambos podem fazer entregas
    const { data: users } = await supabase.from('perfis').select('id, nome').order('nome');
    setAvailableStores(stores || []);
    setAvailableDrivers(users || []);
  };

  const showNotification = (message: string, type: 'success' | 'info' | 'alert') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchRecentActivities = async () => {
    try {
      let query = supabase
        .from('entregas')
        .select('*, estabelecimentos(nome, endereco), perfis:entregador_id(nome)')
        .order('criado_at', { ascending: false });

      if (filterStatus !== 'all') query = query.eq('status', filterStatus);
      if (filterDriver !== 'all') query = query.eq('entregador_id', filterDriver);
      if (filterStore !== 'all') query = query.eq('estabelecimento_id', filterStore);
      if (filterSearch) {
        query = query.or(`nome_cliente.ilike.%${filterSearch}%,observacao.ilike.%${filterSearch}%`);
      }

      const { data, error } = await query.limit(20);

      if (error) throw error;
      setRecentActivities(data || []);
    } catch (err) {
      console.error('Erro ao buscar atividades:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'atribuida': return 'text-orange-primary animate-pulse';
      case 'aceita': return 'text-sky-400';
      case 'coletada': return 'text-indigo-400';
      case 'em_rota': return 'text-amber-400';
      case 'finalizada': return 'text-lime-500';
      case 'recusada': return 'text-red-500';
      case 'aguardando': return 'text-gray-500';
      default: return 'text-gray-400';
    }
  };

  const formatTime = (dateString: string) => {
    const diff = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 60000);
    if (diff < 1) return 'Agora';
    if (diff < 60) return `${diff}m`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  return (
    <div className="space-y-6 animate-fade">
      {/* Ultra Clean Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={profile?.foto_url || "https://picsum.photos/seed/admin/100/100"} className="w-10 h-10 rounded-full border border-white/10" alt="Profile" />
          <div>
            <h1 className="text-sm font-black tracking-tight text-gray-400 uppercase">Olá, {profile?.nome || 'Admin'}</h1>
            <p className="text-[10px] text-gray-600 font-bold flex items-center gap-1 uppercase tracking-tighter">
              <MapPin size={10} className="text-orange-primary" /> Açailândia • MA
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="w-9 h-9 bg-white/5 rounded-full flex items-center justify-center text-gray-500 relative">
            <Bell size={18} strokeWidth={2} />
            <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-orange-primary rounded-full border border-black"></span>
          </button>
        </div>
      </header>

      {/* Minimal Search Bar */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700 group-focus-within:text-orange-primary transition-colors" size={16} />
        <input
          type="text"
          placeholder="Buscar cliente ou observação..."
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          className="w-full h-12 bg-[#0A0A0A] rounded-2xl pl-11 pr-4 text-xs font-bold border border-white/5 outline-none focus:border-orange-primary/20 transition-all placeholder:text-gray-700"
        />
      </div>

      <Banner />

      {/* Minimalist Feature Icons */}
      <div className="grid grid-cols-4 gap-4 px-2">
        <QuickAction onClick={() => onViewChange('inbox')} icon={<Package size={18} />} label="Pedidos" />
        <QuickAction onClick={() => onViewChange('finance')} icon={<TrendingUp size={18} />} label="Ganhos" />
        <QuickAction onClick={() => onViewChange('drivers')} icon={<Users size={18} />} label="Equipe" />
        <QuickAction onClick={() => onViewChange('new_client')} icon={<Plus size={18} />} label="Novo" active />
      </div>

      {/* Filters Section - Premium UI Unified */}
      <section className="space-y-3 px-1">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-1 h-3 bg-orange-primary rounded-full" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Filtros Avançados</h2>
          </div>
          {(filterStatus !== 'all' || filterDriver !== 'all' || filterStore !== 'all') && (
            <button
              onClick={() => { setFilterStatus('all'); setFilterDriver('all'); setFilterStore('all'); }}
              className="text-[9px] font-black text-white/40 hover:text-orange-primary uppercase tracking-widest transition-colors flex items-center gap-1"
            >
              <Plus size={10} className="rotate-45" /> Limpar
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Status Filter */}
          <div className="relative bg-white/[0.03] border border-white/5 rounded-2xl px-3 h-12 flex items-center justify-center gap-2 hover:bg-white/[0.06] transition-all active:scale-95 group overflow-hidden">
            <Bell size={14} className="shrink-0 text-white group-hover:text-orange-primary transition-colors" />
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] truncate">
              {filterStatus === 'all' ? 'STATUS' : filterStatus.toUpperCase()}
            </span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
            >
              <option value="all">STATUS</option>
              <option value="atribuida">ATRIBUÍDA</option>
              <option value="aceita">ACEITA</option>
              <option value="em_rota">EM ROTA</option>
              <option value="coletada">COLETADA</option>
              <option value="finalizada">FINALIZADA</option>
              <option value="aguardando">AGUARDANDO</option>
            </select>
          </div>

          {/* Store Filter */}
          <div className="relative bg-white/[0.03] border border-white/5 rounded-2xl px-3 h-12 flex items-center justify-center gap-2 hover:bg-white/[0.06] transition-all active:scale-95 group overflow-hidden">
            <MapPin size={14} className="shrink-0 text-white group-hover:text-orange-primary transition-colors" />
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] truncate">
              {filterStore === 'all' ? 'LOJAS' : availableStores.find(s => s.id === filterStore)?.nome.toUpperCase() || 'LOJAS'}
            </span>
            <select
              value={filterStore}
              onChange={(e) => setFilterStore(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
            >
              <option value="all">LOJAS</option>
              {availableStores.map(s => <option key={s.id} value={s.id}>{s.nome.toUpperCase()}</option>)}
            </select>
          </div>

          {/* Driver Filter */}
          <div className="relative bg-white/[0.03] border border-white/5 rounded-2xl px-3 h-12 flex items-center justify-center gap-2 hover:bg-white/[0.06] transition-all active:scale-95 group overflow-hidden">
            <Users size={14} className="shrink-0 text-white group-hover:text-orange-primary transition-colors" />
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] truncate">
              {filterDriver === 'all' ? 'EQUIPE' : availableDrivers.find(d => d.id === filterDriver)?.nome.toUpperCase() || 'EQUIPE'}
            </span>
            <select
              value={filterDriver}
              onChange={(e) => setFilterDriver(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
            >
              <option value="all">EQUIPE</option>
              {availableDrivers.map(d => <option key={d.id} value={d.id}>{d.nome.toUpperCase()}</option>)}
            </select>
          </div>

          <button
            onClick={() => onViewChange('inbox')}
            className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-3 h-12 text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-white/[0.06] transition-all active:scale-95"
          >
            <Package size={14} className="shrink-0 text-white" /> PENDENTES
          </button>
        </div>
      </section>

      {/* Activity List - Refined */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-1 h-3 bg-lime-500 rounded-full" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Histórico de Atividades</h2>
          </div>
        </div>

        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-orange-primary" size={24} /></div>
          ) : recentActivities.length === 0 ? (
            <div className="text-center py-8 text-[10px] text-gray-700 font-black uppercase tracking-widest">Nenhuma atividade recente</div>
          ) : (
            recentActivities.map((activity) => (
              <ActivityItem
                key={activity.id}
                onClick={() => setSelectedActivity(activity)}
                store={activity.estabelecimentos?.nome || 'Estabelecimento'}
                status={activity.status.charAt(0).toUpperCase() + activity.status.slice(1).replace('_', ' ')}
                driver={activity.perfis?.nome || 'Pendente'}
                time={formatTime(activity.criado_at)}
                color={getStatusColor(activity.status)}
              />
            ))
          )}
        </div>
      </section>

      {/* Floating Notification */}
      {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-fade">
          <div className={`px-6 py-3 rounded-2xl flex items-center gap-3 shadow-2xl border ${notification.type === 'success' ? 'bg-lime-500 border-lime-400 text-white' :
            notification.type === 'info' ? 'bg-orange-primary border-orange-400 text-white' :
              'bg-zinc-900 border-white/5 text-white'
            }`}>
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedActivity && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-sm animate-fade" onClick={() => setSelectedActivity(null)}>
          <div className="w-full max-w-xl bg-[#0A0A0A] rounded-t-[3rem] border-t border-white/5 p-8 pb-12 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-900 rounded-full mx-auto mb-8"></div>

            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tighter uppercase">{selectedActivity.estabelecimentos?.nome}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(selectedActivity.status).replace('text-', 'bg-')} shadow-lg`}></div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{selectedActivity.status.replace('_', ' ')}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Valor Entrega</p>
                <p className="text-2xl font-black text-white">R$ {parseFloat(selectedActivity.valor_total).toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass-card p-6 rounded-3xl border-white/5 bg-white/[0.02]">
                <h3 className="text-[10px] font-black text-orange-primary uppercase tracking-[0.2em] mb-4">🏪 Dados do Estabelecimento</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-[9px] text-gray-700 font-black uppercase tracking-widest mb-0.5">Endereço de Coleta</p>
                    <p className="text-[11px] text-gray-300 font-medium leading-relaxed">{selectedActivity.estabelecimentos?.endereco || 'Endereço não informado'}</p>
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 rounded-3xl border-white/5 bg-white/[0.02]">
                <h3 className="text-[10px] font-black text-lime-500 uppercase tracking-[0.2em] mb-4">📍 Detalhes da Entrega</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-[9px] text-gray-700 font-black uppercase tracking-widest mb-0.5">Observações / WhatsApp</p>
                    <p className="text-[11px] text-gray-300 font-medium leading-relaxed whitespace-pre-wrap">{selectedActivity.observacao}</p>
                  </div>
                  <div className="pt-2 border-t border-white/5 flex justify-between">
                    <div>
                      <p className="text-[9px] text-gray-700 font-black uppercase tracking-widest mb-0.5">Entregador</p>
                      <p className="text-[11px] text-gray-300 font-medium">{selectedActivity.perfis?.nome || 'Não Atribuído'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-gray-700 font-black uppercase tracking-widest mb-0.5">Ganhos Admin</p>
                      <p className="text-[11px] text-lime-500 font-bold">R$ {parseFloat(selectedActivity.lucro_admin).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <button onClick={() => setSelectedActivity(null)} className="w-full h-14 bg-white/5 text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Novo Cliente */}
      {showNewClientForm && (
        <NewClientForm
          onClose={() => onViewChange('dashboard')}
          onSuccess={() => {
            onViewChange('dashboard');
            fetchFilterData();
            showNotification('Cliente cadastrado com sucesso!', 'success');
          }}
        />
      )}
    </div>
  );
};

const QuickAction = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className="flex flex-col items-center gap-2 group">
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${active ? 'bg-orange-primary text-white border-transparent shadow-lg shadow-orange-primary/20' : 'bg-[#0A0A0A] border-white/5 text-gray-600 group-hover:text-gray-300'
      }`}>
      {icon}
    </div>
    <span className="text-[9px] font-black text-gray-600 tracking-tighter uppercase">{label}</span>
  </button>
);

const ActivityItem = ({ store, status, time, color, driver, onClick }: any) => (
  <div onClick={onClick} className="glass-card p-4 rounded-2xl flex items-center justify-between group cursor-pointer hover:border-white/10 transition-colors">
    <div className="flex items-center gap-4">
      <div className="w-1.5 h-1.5 rounded-full bg-current opacity-40"></div>
      <div>
        <h4 className="text-xs font-black tracking-tight">{store}</h4>
        <div className="flex items-center gap-2 mt-0.5">
          <p className={`text-[9px] font-black uppercase tracking-widest ${color}`}>{status}</p>
          <span className="text-[14px] text-gray-800">•</span>
          <p className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter">{driver}</p>
        </div>
      </div>
    </div>
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-bold text-gray-700">{time}</span>
      <ChevronRight size={14} className="text-gray-800" />
    </div>
  </div>
);

export default AdminDashboard;
