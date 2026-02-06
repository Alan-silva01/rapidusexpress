
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Perfil } from '../types';
import { Power, Navigation, ChevronRight, Activity, CheckCircle2, XCircle, AlertTriangle, Loader2, PackageCheck, Bike, RefreshCw, History, Phone, MapPin, MessageCircle, Sun } from 'lucide-react';
import Modal from '../components/Modal';

interface DriverDashboardProps {
  profile: Perfil;
  onViewChange?: (view: any) => void;
}

const DriverDashboard: React.FC<DriverDashboardProps> = ({ profile, onViewChange }) => {
  const [isOnline, setIsOnline] = useState(profile.disponivel);
  const [modalType, setModalType] = useState<'success' | 'error' | 'confirm' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [driverProfile, setDriverProfile] = useState<Perfil>(profile);
  const [highContrast, setHighContrast] = useState(false);

  const [assignedDeliveries, setAssignedDeliveries] = useState<any[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<any[]>([]);
  const [historyDeliveries, setHistoryDeliveries] = useState<any[]>([]);
  const [todayDeliveries, setTodayDeliveries] = useState<any[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [selectedDelivery, setSelectedDelivery] = useState<any | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

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
        fetchDeliveries(true); // Chamada silenciosa
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'perfis',
        filter: `id=eq.${profile.id}`
      }, () => fetchDriverData(true))
      .subscribe();

    return () => {
      supabase.removeChannel(deliveriesChannel);
    };
  }, [profile.id]);

  const fetchDriverData = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data } = await supabase.from('perfis').select('*').eq('id', profile.id).single();
    if (data) {
      setDriverProfile(data);
      setIsOnline(data.disponivel);
    }
  };

  const fetchDeliveries = async (silent = false) => {
    if (!silent) setLoading(true);
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

      const finalizadas = data?.filter(d => d.status === 'finalizada') || [];
      const hoje = new Date().toISOString().split('T')[0];
      const hojeOnly = finalizadas.filter(d => d.criado_at.startsWith(hoje));

      setHistoryDeliveries(finalizadas.slice(0, 20));
      setTodayDeliveries(hojeOnly);

      const total = finalizadas.reduce((acc, curr) => acc + parseFloat(profile.funcao === 'admin' ? curr.valor_total : curr.valor_entregador), 0);
      setTotalEarned(total);
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
        const { error } = await supabase.from('entregas').update({ status: 'em_rota' }).eq('id', id);
        if (error) throw error;
      } else if (type === 'collect') {
        const { error } = await supabase.from('entregas').update({ status: 'coletada' }).eq('id', id);
        if (error) throw error;
      } else if (type === 'finish') {
        const { error } = await supabase.rpc('finalizar_entrega', { p_entrega_id: id });
        if (error) throw error;
        setModalType('success');
      } else if (type === 'reject') {
        const { error } = await supabase.rpc('recusar_entrega', { p_entrega_id: id });
        if (error) throw error;

        fetch('https://iqsdjmhuznrfczefbluk.functions.supabase.co/push-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'REJECT',
            record: {
              driver_name: driverProfile?.nome || 'Entregador',
              delivery_id: id
            }
          })
        }).catch(pushErr => console.warn('Falha silenciosa ao notificar admins:', pushErr));

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

  const getStatusInfo = (status: string, estabelecimentoNome: string = 'Estabelecimento', clienteNome: string = 'Cliente') => {
    switch (status) {
      case 'em_rota': return { label: `Vá até a ${estabelecimentoNome}`, sub: 'Indo coletar o pedido', icon: <Bike size={18} /> };
      case 'coletada': return { label: `Entregar para ${clienteNome}`, sub: 'Pedido em mãos, vá ao cliente', icon: <Navigation size={18} /> };
      default: return { label: 'Em andamento', sub: 'Atualize o status', icon: <Activity size={18} /> };
    }
  };

  const formatObservation = (obs: any) => {
    if (!obs) return 'Sem observações';
    if (typeof obs === 'string') return obs.replace('Extraída do WhatsApp: ', '');
    return JSON.stringify(obs);
  };

  const formatAddress = (delivery: any) => {
    const addr = delivery.endereco_cliente;
    if (!addr) return 'Endereço não informado';
    if (Array.isArray(addr)) return addr.join(', ');
    return addr;
  };

  const getMapsUrl = (address: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  const getWhatsAppUrl = (phone: string, storeName: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent(`Olá! Sou o entregador da ${storeName}.`);
    return `https://wa.me/55${cleanPhone}?text=${message}`;
  };

  const formatClientName = (delivery: any) => {
    if (delivery.nome_cliente) return delivery.nome_cliente;
    if (delivery.observacao) {
      const cleanObs = delivery.observacao.replace('Extraída do WhatsApp: ', '');
      if (cleanObs.length < 40) return cleanObs;
    }
    return 'N/A';
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
            <p className={`text-[9px] font-black uppercase tracking-widest ${isOnline ? 'text-lime-500' : 'text-gray-600'}`}>
              {isOnline ? 'Você está Ativo' : 'Você não está Ativo'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Botão de Alto Contraste */}
          <button
            onClick={() => setHighContrast(!highContrast)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${highContrast ? 'bg-white text-black' : 'bg-white/5 text-gray-500 hover:text-white'}`}
            title="Modo Alto Contraste (Sol)"
          >
            <Sun size={16} strokeWidth={3} />
          </button>

          <button
            onClick={() => fetchDeliveries()}
            className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center text-gray-500 hover:text-orange-primary transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={toggleOnline}
            disabled={processing}
            className={`h-9 px-4 rounded-xl flex items-center gap-2 font-black text-[9px] uppercase tracking-widest transition-all ${isOnline ? 'bg-lime-500 text-white shadow-lg shadow-lime-500/20' : 'bg-white/5 text-gray-600'
              }`}
          >
            {processing ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} strokeWidth={3} />} {isOnline ? 'Ativo' : 'Ficar Ativo'}
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
                <div key={delivery.id} className="glass-card p-5 rounded-3xl border-orange-primary/30 bg-orange-primary/5 animate-pulse-subtle">
                  <div onClick={() => setSelectedDelivery(delivery)} className="flex justify-between items-start mb-4 cursor-pointer">
                    <div>
                      <h4 className="text-sm font-black text-white">{delivery.estabelecimentos?.nome || 'Estabelecimento'}</h4>
                      <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">
                        {profile.funcao === 'admin' ? 'Valor Total: ' : 'Sua parte: '}
                        <span className="text-orange-primary">R$ {parseFloat(profile.funcao === 'admin' ? delivery.valor_total : delivery.valor_entregador).toFixed(2)}</span>
                      </p>
                    </div>
                    <div className="bg-orange-primary text-white px-3 py-1.5 rounded-xl">
                      <span className="text-[9px] font-black uppercase tracking-widest">Ver Detalhes</span>
                    </div>
                  </div>

                  <div className="space-y-3 mb-5">
                    {/* Coleta */}
                    <div className="flex gap-3 text-[10px]">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-primary mt-1 shrink-0 shadow-[0_0_8px_rgba(255,77,0,0.5)]"></div>
                      <div>
                        <p className="text-gray-600 font-black uppercase tracking-widest text-[8px]">Coleta (Loja)</p>
                        <p className="text-gray-300 font-medium leading-tight line-clamp-1">{formatAddress({ ...delivery, endereco_cliente: delivery.estabelecimentos?.endereco })}</p>
                      </div>
                    </div>
                    {/* Entrega */}
                    <div className="flex gap-3 text-[10px]">
                      <div className="w-1.5 h-1.5 rounded-full bg-lime-500 mt-1 shrink-0 shadow-[0_0_8px_rgba(132,204,22,0.5)]"></div>
                      <div>
                        <p className="text-gray-600 font-black uppercase tracking-widest text-[8px]">Entrega (Cliente)</p>
                        <p className="text-gray-300 font-medium leading-tight line-clamp-1">{formatAddress(delivery)}</p>
                      </div>
                    </div>
                    {delivery.observacao && (
                      <div className="bg-black/20 p-2 rounded-xl border border-white/5">
                        <p className="text-[9px] text-orange-primary/80 font-bold italic line-clamp-2">
                          {formatObservation(delivery.observacao)}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleAction('reject', delivery.id)} className="h-11 rounded-2xl bg-white/5 text-gray-400 font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-white/10 transition-colors">
                      <XCircle size={14} /> Recusar
                    </button>
                    <button onClick={() => handleAction('accept', delivery.id)} className="h-11 rounded-2xl bg-orange-primary text-white font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg shadow-orange-primary/20 hover:scale-105 active:scale-95 transition-all">
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
                  const info = getStatusInfo(task.status, task.estabelecimentos?.nome, formatClientName(task));
                  const isExpanded = expandedId === task.id;

                  return (
                    <div key={task.id} className={`glass-card p-5 rounded-3xl border-white/5 relative overflow-hidden transition-all duration-300 ${isExpanded ? 'ring-1 ring-orange-primary/30' : ''}`}>
                      <div onClick={() => toggleExpand(task.id)} className="flex items-center gap-4 cursor-pointer">
                        <div className="w-10 h-10 bg-orange-primary/10 rounded-xl flex items-center justify-center text-orange-primary">
                          {info.icon}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-black tracking-tight text-white">{task.estabelecimentos?.nome}</h4>
                          <p className="text-[10px] font-black uppercase tracking-widest text-orange-primary mt-0.5">{info.label}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-white">R$ {parseFloat(profile.funcao === 'admin' ? task.valor_total : task.valor_entregador).toFixed(2)}</p>
                          <ChevronRight size={14} className={`text-gray-700 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-orange-primary' : ''}`} />
                        </div>
                      </div>

                      <div className={`expandable-content ${isExpanded ? 'expanded' : ''}`}>
                        <div className="expandable-inner space-y-4">
                          <div className="space-y-3">
                            {/* Seção de Coleta */}
                            <div className={`p-4 rounded-2xl border ${highContrast ? 'bg-white border-gray-200' : 'bg-orange-primary/5 border-orange-primary/10'}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${highContrast ? 'bg-orange-500 text-white' : 'bg-orange-primary/20 text-orange-primary'}`}>
                                  <PackageCheck size={12} />
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${highContrast ? 'text-gray-800' : 'text-orange-primary'}`}>Ponto de Coleta</span>
                              </div>
                              <p className={`font-black uppercase tracking-tight mb-1 ${highContrast ? 'text-black text-lg' : 'text-white text-xs'}`}>{task.estabelecimentos?.nome}</p>
                              <p className={`font-medium leading-tight mb-3 ${highContrast ? 'text-black text-xl font-bold' : 'text-[10px] text-gray-400'}`}>
                                {formatAddress({ ...task, endereco_cliente: task.estabelecimentos?.endereco })}
                              </p>
                              <a
                                href={getMapsUrl(formatAddress({ ...task, endereco_cliente: task.estabelecimentos?.endereco }))}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center justify-center gap-2 w-full h-11 rounded-xl text-[10px] font-black uppercase transition-colors ${highContrast ? 'bg-black text-white hover:bg-gray-800' : 'bg-white/5 hover:bg-white/10 text-gray-300'}`}
                              >
                                <MapPin size={14} /> Navegar para Coleta
                              </a>
                            </div>

                            {/* Seção de Entrega */}
                            <div className={`p-4 rounded-2xl border ${highContrast ? 'bg-white border-gray-200' : 'bg-lime-500/5 border-lime-500/10'}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${highContrast ? 'bg-lime-600 text-white' : 'bg-lime-500/20 text-lime-500'}`}>
                                  <MapPin size={12} />
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${highContrast ? 'text-gray-800' : 'text-lime-500'}`}>Ponto de Entrega</span>
                              </div>
                              <div className="flex flex-col gap-2 mb-3">
                                <p className={`font-black uppercase tracking-tight line-clamp-2 ${highContrast ? 'text-black text-lg' : 'text-white text-xs'}`}>{formatClientName(task)}</p>
                                {task.telefone_cliente && (
                                  <div className="flex gap-2 w-full">
                                    <a
                                      href={getWhatsAppUrl(task.telefone_cliente, task.estabelecimentos?.nome || '')}
                                      onClick={(e) => e.stopPropagation()}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-1 flex items-center justify-center gap-1.5 bg-lime-600 text-white px-2.5 py-2.5 rounded-lg text-[10px] font-black uppercase hover:scale-105 active:scale-95 transition-all shadow-lg shadow-lime-600/20"
                                    >
                                      <MessageCircle size={14} fill="currentColor" /> WhatsApp
                                    </a>
                                    <a
                                      href={`tel:${task.telefone_cliente.replace(/\D/g, '')}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex-1 flex items-center justify-center gap-1.5 bg-lime-500 text-white px-2.5 py-2.5 rounded-lg text-[10px] font-black uppercase hover:scale-105 active:scale-95 transition-all shadow-lg shadow-lime-500/20"
                                    >
                                      <Phone size={14} fill="currentColor" /> Ligar
                                    </a>
                                  </div>
                                )}
                              </div>
                              <p className={`font-medium leading-tight mb-4 ${highContrast ? 'text-black text-2xl font-bold' : 'text-[11px] text-gray-400'}`}>
                                {formatAddress(task)}
                              </p>
                              <a
                                href={getMapsUrl(formatAddress(task))}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center justify-center gap-2 w-full h-11 rounded-xl text-[10px] font-black uppercase transition-colors ${highContrast ? 'bg-black text-white hover:bg-gray-800' : 'bg-white/5 hover:bg-white/10 text-gray-300'}`}
                              >
                                <Navigation size={14} /> Navegar para Entrega
                              </a>
                            </div>

                            {/* Observações */}
                            {task.observacao && (
                              <div className={`p-3 rounded-2xl border ${highContrast ? 'bg-yellow-100 border-yellow-200' : 'bg-zinc-900 border-white/5'}`}>
                                <p className={`text-[8px] font-black uppercase tracking-widest mb-1 flex items-center gap-1 ${highContrast ? 'text-gray-800' : 'text-gray-600'}`}>
                                  <AlertTriangle size={10} className="text-orange-primary" /> Observação Importante
                                </p>
                                <p className={`font-bold italic leading-relaxed ${highContrast ? 'text-black text-sm' : 'text-[10px] text-orange-primary/90'}`}>
                                  {formatObservation(task.observacao)}
                                </p>
                              </div>
                            )}
                          </div>

                          {task.status === 'em_rota' && (
                            <button onClick={(e) => { e.stopPropagation(); handleAction('collect', task.id); }} className="w-full h-12 bg-orange-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-primary/20">
                              {processing ? <Loader2 className="animate-spin" size={14} /> : <PackageCheck size={14} />} Confirmar Coleta na Loja
                            </button>
                          )}

                          {task.status === 'coletada' && (
                            <button onClick={(e) => { e.stopPropagation(); handleAction('finish', task.id); }} className="w-full h-12 bg-lime-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-lime-500/20">
                              {processing ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />} Entrega Concluída
                            </button>
                          )}

                          {task.status === 'em_rota' && profile.funcao === 'admin' && (
                            <button onClick={(e) => { e.stopPropagation(); handleAction('reject', task.id); }} className="w-full h-10 bg-white/5 text-gray-600 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all">
                              Desistir da Entrega
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-3xl border-white/5 bg-white/[0.02]">
          <p className="text-[9px] font-black text-gray-700 uppercase mb-1 tracking-widest">{profile.funcao === 'admin' ? 'Seus Ganhos Totais' : 'Saldo para Receber'}</p>
          <p className="text-xl font-black text-white tracking-tighter">R$ {(profile.funcao === 'admin' ? totalEarned : parseFloat(driverProfile.saldo?.toString() || '0')).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          {profile.funcao !== 'admin' && <p className="text-[8px] text-gray-600 font-bold mt-1 uppercase tracking-tighter">Disponível para saque</p>}
        </div>
        <div className="glass-card p-5 rounded-3xl border-white/5 bg-white/[0.02]">
          <p className="text-[9px] font-black text-gray-700 uppercase mb-1 tracking-widest">Ganhos Hoje (Total)</p>
          <p className="text-xl font-black text-lime-500 tracking-tighter">R$ {
            todayDeliveries.reduce((acc, curr) => acc + parseFloat(profile.funcao === 'admin' ? curr.valor_total : curr.valor_entregador), 0).toFixed(2)
          }</p>
          <p className="text-[8px] text-gray-600 font-bold mt-1 uppercase tracking-tighter">{todayDeliveries.length} {todayDeliveries.length === 1 ? 'entrega hoje' : 'entregas hoje'}</p>
        </div>
      </div>

      {historyDeliveries.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">Últimas 20 Entregas</h3>
            <button
              onClick={() => onViewChange?.('history')}
              className="text-[9px] font-black text-gray-600 hover:text-orange-primary uppercase tracking-widest transition-colors flex items-center gap-1"
            >
              <History size={12} /> Ver Tudo
            </button>
          </div>
          <div className="space-y-2">
            {historyDeliveries.map(delivery => {
              const isExpanded = expandedId === delivery.id;
              return (
                <div key={delivery.id} className={`glass-card p-4 rounded-2xl border-white/5 bg-white/[0.02] transition-all duration-300 ${isExpanded ? 'ring-1 ring-white/10' : ''}`}>
                  <div onClick={() => toggleExpand(delivery.id)} className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center text-gray-600">
                        <CheckCircle2 size={16} className="text-lime-500" />
                      </div>
                      <div>
                        <h4 className="text-[11px] font-bold text-gray-300">{delivery.estabelecimentos?.nome}</h4>
                        <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">{new Date(delivery.criado_at).toLocaleDateString('pt-BR')} • {new Date(delivery.criado_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <p className="text-xs font-black text-white">R$ {parseFloat(profile.funcao === 'admin' ? delivery.valor_total : delivery.valor_entregador).toFixed(2)}</p>
                      <ChevronRight size={10} className={`text-gray-800 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </div>

                  <div className={`expandable-content ${isExpanded ? 'expanded' : ''}`}>
                    <div className="expandable-inner pt-2 space-y-3">
                      <div className="h-px bg-white/5 w-full"></div>
                      <div className="grid grid-cols-1 gap-2 text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                        <div>
                          <p className="text-gray-700 text-[7px] mb-0.5">Destinatário</p>
                          <p className="text-gray-300">{formatClientName(delivery)}</p>
                        </div>
                        <div>
                          <p className="text-gray-700 text-[7px] mb-0.5">Endereço de Entrega</p>
                          <p className="text-gray-300 leading-relaxed">{formatAddress(delivery)}</p>
                        </div>
                        {delivery.observacao && (
                          <div>
                            <p className="text-gray-700 text-[7px] mb-0.5">Observações</p>
                            <p className="text-orange-primary/70 italic normal-case">{formatObservation(delivery.observacao)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {modalType === 'success' && (
        <Modal
          isOpen={true}
          onClose={() => setModalType(null)}
          type="success"
          title="Entrega Concluída!"
          message="Parabéns! A entrega foi registrada com sucesso. O valor já foi adicionado ao seu saldo."
          primaryAction={{
            label: 'Continuar',
            onClick: () => setModalType(null)
          }}
        />
      )}

      {selectedDelivery && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md overflow-y-auto overflow-x-hidden" onClick={() => setSelectedDelivery(null)}>
          <div className="w-full max-w-xl bg-zinc-950 rounded-[3rem] border border-white/5 p-8 pb-12 my-auto shadow-2xl" onClick={e => e.stopPropagation()}>
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
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">{profile.funcao === 'admin' ? 'Valor da Entrega' : 'Seu Ganho'}</p>
                <p className="text-2xl font-black text-orange-primary">R$ {parseFloat(profile.funcao === 'admin' ? selectedDelivery.valor_total : selectedDelivery.valor_entregador).toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Seção Coleta */}
              <div className={`p-6 rounded-3xl border ${highContrast ? 'bg-white border-gray-200' : 'bg-orange-primary/5 border-orange-primary/10'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${highContrast ? 'bg-orange-500 text-white' : 'bg-orange-primary/20 text-orange-primary'}`}>
                    <PackageCheck size={16} />
                  </div>
                  <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${highContrast ? 'text-gray-800' : 'text-orange-primary'}`}>Ponto de Coleta (Loja)</h3>
                </div>
                <div className="space-y-3 mb-6">
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${highContrast ? 'text-gray-600' : 'text-gray-600'}`}>Estabelecimento</p>
                    <p className={`text-sm font-black uppercase tracking-tight ${highContrast ? 'text-black' : 'text-white'}`}>{selectedDelivery.estabelecimentos?.nome || 'N/A'}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${highContrast ? 'text-gray-600' : 'text-gray-600'}`}>Endereço de Retirada</p>
                    <p className={`text-xs font-medium leading-relaxed ${highContrast ? 'text-black text-lg' : 'text-gray-300'}`}>{formatAddress({ ...selectedDelivery, endereco_cliente: selectedDelivery.estabelecimentos?.endereco })}</p>
                  </div>
                </div>
                <a
                  href={getMapsUrl(formatAddress({ ...selectedDelivery, endereco_cliente: selectedDelivery.estabelecimentos?.endereco }))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-center gap-3 w-full h-12 rounded-2xl text-[10px] font-black uppercase transition-all ${highContrast ? 'bg-black text-white' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                >
                  <MapPin size={14} /> Abrir GPS para Coleta
                </a>
              </div>

              {/* Seção Entrega */}
              <div className={`p-6 rounded-3xl border ${highContrast ? 'bg-white border-gray-200' : 'bg-lime-500/5 border-lime-500/10'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${highContrast ? 'bg-lime-600 text-white' : 'bg-lime-500/20 text-lime-500'}`}>
                    <MapPin size={16} />
                  </div>
                  <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${highContrast ? 'text-gray-800' : 'text-lime-500'}`}>Ponto de Entrega (Cliente)</h3>
                </div>
                <div className="space-y-4 mb-6">
                  <div className="flex flex-col gap-3">
                    <div className="flex-1">
                      <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${highContrast ? 'text-gray-600' : 'text-gray-600'}`}>Cliente</p>
                      <p className={`text-sm font-black uppercase tracking-tight break-words ${highContrast ? 'text-black' : 'text-white'}`}>{formatClientName(selectedDelivery)}</p>
                    </div>
                    {selectedDelivery.telefone_cliente && (
                      <div className="flex gap-2 w-full mt-1">
                        <a
                          href={getWhatsAppUrl(selectedDelivery.telefone_cliente, selectedDelivery.estabelecimentos?.nome || '')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 bg-lime-600 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-lime-600/20 hover:scale-105 active:scale-95 transition-all"
                        >
                          <MessageCircle size={14} fill="currentColor" /> WhatsApp
                        </a>
                        <a
                          href={`tel:${selectedDelivery.telefone_cliente.replace(/\D/g, '')}`}
                          className="flex-1 flex items-center justify-center gap-2 bg-lime-500 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-lime-500/20 hover:scale-105 active:scale-95 transition-all"
                        >
                          <Phone size={14} fill="currentColor" /> Ligar
                        </a>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${highContrast ? 'text-gray-600' : 'text-gray-600'}`}>Endereço do Destino</p>
                    <p className={`font-medium leading-relaxed ${highContrast ? 'text-black text-2xl font-bold' : 'text-xs text-gray-300'}`}>{formatAddress(selectedDelivery)}</p>
                  </div>
                  {selectedDelivery.observacao && (
                    <div className={`p-3 rounded-xl border ${highContrast ? 'bg-yellow-100 border-yellow-200' : 'bg-black/20 border-white/5'}`}>
                      <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${highContrast ? 'text-gray-800' : 'text-orange-primary'}`}>📝 Observações</p>
                      <p className={`text-[11px] font-medium italic ${highContrast ? 'text-black' : 'text-gray-200'}`}>
                        {formatObservation(selectedDelivery.observacao)}
                      </p>
                    </div>
                  )}
                </div>
                <a
                  href={getMapsUrl(formatAddress(selectedDelivery))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center justify-center gap-3 w-full h-12 rounded-2xl text-[10px] font-black uppercase transition-all ${highContrast ? 'bg-black text-white' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                >
                  <Navigation size={14} /> Abrir GPS para Entrega
                </a>
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
                  <PackageCheck size={18} /> Confirmar Coleta na Loja
                </button>
              ) : selectedDelivery.status === 'coletada' ? (
                <button onClick={() => { handleAction('finish', selectedDelivery.id); setSelectedDelivery(null); }} className="w-full h-16 bg-lime-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-lime-500/20 flex items-center justify-center gap-2">
                  <CheckCircle2 size={18} /> Entrega Concluída
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
