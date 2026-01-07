
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Perfil } from '../types';
import { Power, Navigation, ChevronRight, Activity, CheckCircle2, XCircle, AlertTriangle, Loader2, PackageCheck, Bike, RefreshCw, History } from 'lucide-react';

interface DriverDashboardProps {
  profile: Perfil;
}

const DriverDashboard: React.FC<DriverDashboardProps> = ({ profile }) => {
  const [isOnline, setIsOnline] = useState(profile.disponivel);
  const [modalType, setModalType] = useState<'success' | 'error' | 'confirm' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [driverProfile, setDriverProfile] = useState<Perfil>(profile);

  const [assignedDeliveries, setAssignedDeliveries] = useState<any[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<any[]>([]);
  const [historyDeliveries, setHistoryDeliveries] = useState<any[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<any | null>(null);

  useEffect(() => {
    fetchDriverData();
    fetchDeliveries();

    // Inscrição em tempo real para mudanças na entrega e no perfil
    const deliveriesChannel = supabase
      .channel(`driver_updates_${profile.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'entregas',
        filter: `entregador_id=eq.${profile.id}`
      }, () => {
        console.log('Realtime update received');
        fetchDeliveries();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'perfis',
        filter: `id=eq.${profile.id}`
      }, () => fetchDriverData())
      .subscribe();

    return () => {
      supabase.removeChannel(deliveriesChannel);
    };
  }, [profile.id]);

  const fetchDriverData = async () => {
    const { data } = await supabase.from('perfis').select('*').eq('id', profile.id).single();
    if (data) {
      setDriverProfile(data);
      setIsOnline(data.disponivel);
    }
  };

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('entregas')
        .select('*, estabelecimentos(nome, endereco)')
        .eq('entregador_id', profile.id)
        .in('status', ['atribuida', 'aceita', 'coletada', 'em_rota', 'finalizada'])
        .order('criado_at', { ascending: false });

      if (error) throw error;

      setAssignedDeliveries(data?.filter(d => d.status === 'atribuida') || []);
      setActiveDeliveries(data?.filter(d => ['aceita', 'coletada', 'em_rota'].includes(d.status)) || []);
      setHistoryDeliveries(data?.filter(d => d.status === 'finalizada').slice(0, 5) || []);
    } catch (err) {
      console.error('Erro ao buscar entregas:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleOnline = async () => {
    setProcessing(true);
    try {
      const nextStatus = !isOnline;
      const { error } = await supabase
        .from('perfis')
        .update({ disponivel: nextStatus })
        .eq('id', profile.id);

      if (error) throw error;
      setIsOnline(nextStatus);
    } catch (err) {
      console.error('Erro ao alternar status:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleAction = async (type: string, id: string) => {
    setProcessing(true);
    try {
      if (type === 'accept') {
        // Ao aceitar, já entra em rota (conforme pedido: "quando ele aceita fica em rota")
        const { error } = await supabase.from('entregas').update({ status: 'em_rota' }).eq('id', id);
        if (error) throw error;
        // Fica indisponível ao aceitar
        await supabase.from('perfis').update({ disponivel: false }).eq('id', profile.id);
        setIsOnline(false);
      } else if (type === 'collect') {
        // Ao coletar (conforme pedido: "quando pega la fica coletado")
        const { error } = await supabase.from('entregas').update({ status: 'coletada' }).eq('id', id);
        if (error) throw error;
      } else if (type === 'finish') {
        const { error } = await supabase.rpc('finalizar_entrega', { p_entrega_id: id });
        if (error) throw error;
        setIsOnline(true);
        setModalType('success');
      } else if (type === 'reject') {
        const { error } = await supabase.rpc('recusar_entrega', { p_entrega_id: id });
        if (error) throw error;

        // Limpeza agressiva local
        setAssignedDeliveries(prev => prev.filter(d => d.id !== id));
        setActiveDeliveries(prev => prev.filter(d => d.id !== id));
        if (selectedDelivery?.id === id) setSelectedDelivery(null);
      }

      await fetchDeliveries();
      await fetchDriverData();
    } catch (err) {
      console.error('Erro ao processar ação:', err);
      alert('Erro ao processar ação');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'em_rota': return { label: 'Em Rota de Busca', sub: 'Indo até o estabelecimento', icon: <Bike size={18} /> };
      case 'coletada': return { label: 'Pedido Coletado', sub: 'Em rota de entrega ao cliente', icon: <Navigation size={18} /> };
      default: return { label: 'Em andamento', sub: 'Atualize o status', icon: <Activity size={18} /> };
    }
  };

  return (
    <div className="space-y-6 animate-fade">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={driverProfile.foto_url || `https://picsum.photos/seed/${profile.id}/100/100`} className="w-10 h-10 rounded-full border border-white/10" alt="" />
            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-black ${isOnline ? 'bg-lime-500' : 'bg-gray-700'}`}></div>
          </div>
          <div>
            <h1 className="text-sm font-black text-gray-300">Olá, {driverProfile.nome.split(' ')[0]}</h1>
            <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{isOnline ? 'Disponível' : 'Você está offline'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchDeliveries()}
            className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center text-gray-500 hover:text-orange-primary transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={toggleOnline}
            disabled={processing}
            className={`h-9 px-4 rounded-xl flex items-center gap-2 font-black text-[9px] uppercase tracking-widest transition-all ${isOnline ? 'bg-orange-primary/10 text-orange-primary border border-orange-primary/20' : 'bg-white/5 text-gray-600'
              }`}
          >
            {processing ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} strokeWidth={3} />} {isOnline ? 'Ativo' : 'Entrar'}
          </button>
        </div>
      </header>

      {loading && assignedDeliveries.length === 0 && activeDeliveries.length === 0 ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-primary" size={32} /></div>
      ) : (
        <>
          {assignedDeliveries.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-primary">Nova Solicitação de Entrega</h3>
              {assignedDeliveries.map(delivery => (
                <div key={delivery.id} className="glass-card p-5 rounded-3xl border-orange-primary/20 bg-orange-primary/5">
                  <div onClick={() => setSelectedDelivery(delivery)} className="flex justify-between items-start mb-4 cursor-pointer">
                    <div>
                      <h4 className="text-sm font-black text-white">{delivery.estabelecimentos?.nome || 'Estabelecimento'}</h4>
                      <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Sua parte: <span className="text-orange-primary">R$ {parseFloat(delivery.valor_entregador).toFixed(2)}</span></p>
                    </div>
                    <div className="bg-orange-primary text-white px-2 py-1 rounded-md">
                      <span className="text-[9px] font-black uppercase tracking-widest">Abrir</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleAction('reject', delivery.id)} className="h-11 rounded-2xl bg-white/5 text-gray-400 font-black text-[10px] uppercase flex items-center justify-center gap-2">
                      <XCircle size={14} /> Recusar
                    </button>
                    <button onClick={() => handleAction('accept', delivery.id)} className="h-11 rounded-2xl bg-orange-primary text-white font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg shadow-orange-primary/20">
                      {processing ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />} Aceitar
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">Tarefas em Andamento</h3>
            {activeDeliveries.length === 0 ? (
              <div className="p-8 text-center text-gray-700 font-bold text-[10px] uppercase tracking-widest border border-dashed border-white/5 rounded-3xl">
                Nenhuma entrega ativa
              </div>
            ) : (
              <div className="space-y-3">
                {activeDeliveries.map(task => {
                  const info = getStatusInfo(task.status);
                  return (
                    <div key={task.id} className="glass-card p-5 rounded-3xl border-white/5 relative overflow-hidden">
                      <div onClick={() => setSelectedDelivery(task)} className="flex items-center gap-4 mb-5 cursor-pointer">
                        <div className="w-10 h-10 bg-orange-primary/10 rounded-xl flex items-center justify-center text-orange-primary">
                          {info.icon}
                        </div>
                        <div>
                          <h4 className="text-sm font-black tracking-tight text-white">{task.estabelecimentos?.nome}</h4>
                          <p className="text-[9px] font-black uppercase tracking-widest text-orange-primary">{info.label}</p>
                          <p className="text-[8px] text-gray-500 mt-1 uppercase font-bold">{info.sub}</p>
                        </div>
                        <div className="ml-auto text-right">
                          <p className="text-sm font-black text-white">R$ {parseFloat(task.valor_entregador).toFixed(2)}</p>
                          <span className="text-[8px] font-black text-orange-primary uppercase tracking-widest">Abrir Detalhes</span>
                        </div>
                      </div>

                      <div className="bg-black/20 p-3 rounded-2xl mb-4 text-[9px] text-gray-400 font-medium">
                        <p className="mb-1"><span className="text-gray-600 uppercase font-black tracking-widest">Loja:</span> {task.estabelecimentos?.endereco || 'Endereço da loja'}</p>
                        <p><span className="text-gray-600 uppercase font-black tracking-widest">Entrega:</span> {task.observacao.replace('Extraída do WhatsApp: ', '')}</p>
                      </div>

                      {task.status === 'em_rota' && (
                        <button onClick={() => handleAction('collect', task.id)} className="w-full h-12 bg-orange-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-primary/20">
                          {processing ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />} Confirmei a Coleta na Loja
                        </button>
                      )}

                      {task.status === 'coletada' && (
                        <button onClick={() => handleAction('finish', task.id)} className="w-full h-12 bg-lime-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-lime-500/20">
                          {processing ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />} Finalizar Entrega ao Cliente
                        </button>
                      )}

                      {task.status === 'em_rota' && (
                        <button onClick={() => handleAction('reject', task.id)} className="mt-3 w-full h-10 bg-white/5 text-gray-600 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all">
                          Desistir da Entrega
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-3xl">
          <p className="text-[9px] font-black text-gray-700 uppercase mb-1 tracking-widest">Meu Saldo</p>
          <p className="text-xl font-black">R$ {parseFloat(driverProfile.saldo?.toString() || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-[8px] text-gray-600 font-bold mt-1 uppercase tracking-tighter">Disponível para saque</p>
        </div>
        <div className="glass-card p-5 rounded-3xl">
          <p className="text-[9px] font-black text-gray-700 uppercase mb-1 tracking-widest">Ganhos Hoje</p>
          <p className="text-xl font-black">R$ {historyDeliveries.reduce((acc, curr) => acc + parseFloat(curr.valor_entregador), 0).toFixed(2)}</p>
          <p className="text-[8px] text-gray-600 font-bold mt-1 uppercase tracking-tighter">{historyDeliveries.length} entregas</p>
        </div>
      </div>

      {historyDeliveries.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">Histórico Recente</h3>
            <History size={14} className="text-gray-800" />
          </div>
          <div className="space-y-2">
            {historyDeliveries.map(delivery => (
              <div key={delivery.id} className="glass-card p-4 rounded-2xl flex items-center justify-between border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center text-gray-600">
                    <CheckCircle2 size={16} className="text-lime-500" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-bold text-gray-300">{delivery.estabelecimentos?.nome}</h4>
                    <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">{new Date(delivery.criado_at).toLocaleDateString('pt-BR')} • {new Date(delivery.criado_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-white">R$ {parseFloat(delivery.valor_entregador).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {modalType === 'success' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm animate-fade">
          <div className="glass-card p-8 rounded-[2.5rem] w-full max-w-xs text-center border-orange-primary/20">
            <div className="w-16 h-16 bg-orange-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 text-orange-primary">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-xl font-black mb-2 uppercase tracking-tighter">Concluída!</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-6">Valor adicionado ao seu saldo.</p>
            <button onClick={() => setModalType(null)} className="w-full h-14 bg-orange-primary text-white font-black rounded-2xl text-xs uppercase shadow-lg shadow-orange-primary/20">Continuar</button>
          </div>
        </div>
      )}

      {selectedDelivery && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-sm animate-fade" onClick={() => setSelectedDelivery(null)}>
          <div className="w-full max-w-xl bg-[#0A0A0A] rounded-t-[3rem] border-t border-white/5 p-8 pb-12 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-900 rounded-full mx-auto mb-8"></div>

            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tighter uppercase">{selectedDelivery.estabelecimentos?.nome}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-2 h-2 rounded-full bg-orange-primary shadow-[0_0_8px_rgba(255,77,0,0.5)]"></div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pedido em andamento</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Seu Ganho</p>
                <p className="text-2xl font-black text-orange-primary">R$ {parseFloat(selectedDelivery.valor_entregador).toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass-card p-6 rounded-3xl border-white/5 bg-white/[0.02]">
                <h3 className="text-[10px] font-black text-orange-primary uppercase tracking-[0.2em] mb-4">🏠 Dados da Retirada (Loja)</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-1">Endereço da Loja</p>
                    <p className="text-[11px] text-gray-300 font-medium leading-relaxed">{selectedDelivery.estabelecimentos?.endereco || 'Endereço não informado'}</p>
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 rounded-3xl border-white/5 bg-white/[0.02]">
                <h3 className="text-[10px] font-black text-lime-500 uppercase tracking-[0.2em] mb-4">📍 Dados da Entrega (Cliente)</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-1">Informações do Pedido</p>
                    <p className="text-[11px] text-gray-300 font-medium leading-relaxed whitespace-pre-wrap">
                      {selectedDelivery.observacao.replace('Extraída do WhatsApp: ', '')}
                    </p>
                  </div>
                </div>
              </div>

              {selectedDelivery.status === 'atribuida' ? (
                <div className="grid grid-cols-2 gap-4 mt-8">
                  <button onClick={() => { handleAction('reject', selectedDelivery.id); setSelectedDelivery(null); }} className="h-14 rounded-2xl bg-white/5 text-gray-400 font-black text-[10px] uppercase flex items-center justify-center gap-2">
                    <XCircle size={16} /> Recusar
                  </button>
                  <button onClick={() => { handleAction('accept', selectedDelivery.id); setSelectedDelivery(null); }} className="h-14 rounded-2xl bg-orange-primary text-white font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-xl shadow-orange-primary/20">
                    <CheckCircle2 size={16} /> Aceitar Entrega
                  </button>
                </div>
              ) : selectedDelivery.status === 'em_rota' ? (
                <button onClick={() => { handleAction('collect', selectedDelivery.id); setSelectedDelivery(null); }} className="w-full h-16 bg-orange-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-orange-primary/20 flex items-center justify-center gap-2">
                  <CheckCircle2 size={18} /> Confirmar Coleta na Loja
                </button>
              ) : selectedDelivery.status === 'coletada' ? (
                <button onClick={() => { handleAction('finish', selectedDelivery.id); setSelectedDelivery(null); }} className="w-full h-16 bg-lime-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-lime-500/20 flex items-center justify-center gap-2">
                  <CheckCircle2 size={18} /> Finalizar Entrega ao Cliente
                </button>
              ) : null}

              <button onClick={() => setSelectedDelivery(null)} className="w-full h-14 bg-white/5 text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;
