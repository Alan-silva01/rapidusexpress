
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Inbox, ChevronRight, UserPlus, MapPin, CreditCard, Clock, Loader2, CheckCircle } from 'lucide-react';

interface PendingDelivery {
  data_hora: string;
  valor_frete: string;
  nome_cliente: string;
  endereco_cliente: string[];
}

interface DeliveriesInboxProps {
  onAssignSuccess?: (view: any) => void;
}

const DeliveriesInbox: React.FC<DeliveriesInboxProps> = ({ onAssignSuccess }) => {
  const [stores, setStores] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningPath, setAssigningPath] = useState<{ storeIndex: number, deliveryIndex: number } | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchInboxData();

    const channel = supabase
      .channel('inbox_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clientes' }, () => {
        fetchInboxData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entregas' }, () => {
        fetchInboxData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchInboxData = async () => {
    setLoading(true);
    try {
      // Buscar estabelecimentos, clientes (JSON) e entregas recusadas (tabela relational)
      const { data: estData } = await supabase.from('estabelecimentos').select('*');
      const { data: clientData } = await supabase.from('clientes').select('numero, entregas');
      const { data: driverData } = await supabase.from('perfis').select('*').eq('funcao', 'entregador');
      const { data: refusedData } = await supabase.from('entregas').select('*').eq('status', 'aguardando');

      // Associar as entregas do JSON dos clientes
      const storesWithDeliveries = (estData || []).map(store => {
        const jsonDeliveries = clientData?.find(c => c.numero === store.numero_whatsapp)?.entregas || [];

        // Formatar entregas do banco (aguardando)
        const formattedDbDeliveries = (refusedData || [])
          .filter(d => d.estabelecimento_id === store.id)
          .map(d => ({
            ...d,
            data_hora: d.data_entrega,
            valor_frete: d.valor_total.toString(),
            nome_cliente: d.nome_cliente || d.observacao?.replace('Extraída do WhatsApp: ', '') || 'Cliente',
            endereco_cliente: Array.isArray(d.endereco_cliente) ? d.endereco_cliente : [d.endereco_cliente].filter(Boolean),
            isFromDB: true
          }));

        // Formatar entregas do JSON com fallbacks
        const formattedJsonDeliveries = jsonDeliveries.map((d: any) => {
          const addr = d.endereco || {};
          const addrArray = [addr.rua, addr.numero, addr.bairro, addr.cidade].filter(Boolean);

          return {
            ...d,
            nome_cliente: d.nome || d.nome_cliente || d.observacao?.replace('Extraída do WhatsApp: ', '') || 'Cliente',
            endereco_cliente: addrArray.length > 0 ? addrArray : [d.observacao?.replace('Extraída do WhatsApp: ', '')].filter(Boolean),
            isFromDB: false
          };
        });

        return {
          ...store,
          entregas: [...formattedJsonDeliveries, ...formattedDbDeliveries]
        };
      });

      setStores(storesWithDeliveries);
      setDrivers(driverData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (store: any, deliveryIndex: number, driver: any) => {
    const delivery = store.entregas[deliveryIndex];
    // Verificar se o entregador ainda está disponível
    if (driver && !driver.disponivel) {
      alert('Este entregador ficou indisponível no momento. Por favor, escolha outro.');
      await fetchInboxData();
      return;
    }

    setProcessing(true);
    try {
      if ((delivery as any).isFromDB) {
        // Se já está no banco (aguardando), usamos a nova RPC financeira
        const { error } = await supabase.rpc('atribuir_entrega_existente', {
          p_entrega_id: (delivery as any).id,
          p_entregador_id: driver?.id || null,
          p_porcentagem_admin: driver?.porcentagem_lucro_admin || 20,
          p_valor_fixo_admin: driver?.valor_fixo_admin || 0
        });
        if (error) throw error;
      } else {
        // Se ainda está no JSON, usamos a RPC que remove do JSON e cria no banco
        const { error } = await supabase.rpc('atribuir_entrega_do_json', {
          p_cliente_numero: store.numero_whatsapp,
          p_json_index: deliveryIndex,
          p_entregador_id: driver?.id || null,
          p_porcentagem_admin: driver?.porcentagem_lucro_admin || 20,
          p_valor_fixo_admin: driver?.valor_fixo_admin || 0
        });
        if (error) throw error;
      }
      setAssigningPath(null);
      await fetchInboxData();

      if (driver) {
        alert(`Entrega enviada para ${driver.nome}. Ele será notificado imediatamente.`);
      } else {
        alert(`Entrega assumida por você.`);
        if (onAssignSuccess) {
          onAssignSuccess('self_delivery');
        }
      }
    } catch (err: any) {
      alert('Erro ao atribuir: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade pb-24">
      <header>
        <h1 className="text-xl font-black uppercase tracking-tighter">Pedidos Pendentes</h1>
        <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Aguardando atribuição</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-primary" size={32} /></div>
      ) : stores.every(s => !s.entregas || s.entregas.length === 0) ? (
        <div className="glass-card p-12 rounded-[2.5rem] text-center border-dashed border-white/5">
          <Inbox size={40} className="mx-auto mb-4 text-gray-800" />
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Inbox Vazio</h3>
        </div>
      ) : (
        <div className="space-y-6">
          {stores.map((store, sIdx) => (
            store.entregas && store.entregas.length > 0 && (
              <div key={store.id} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-primary animate-pulse" />
                  <h2 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">{store.nome}</h2>
                </div>

                {store.entregas.map((delivery: PendingDelivery, dIdx: number) => (
                  <div key={`${store.id}-${dIdx}`} className="glass-card rounded-3xl overflow-hidden border-white/5">
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-5">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 bg-orange-primary/10 rounded-xl flex items-center justify-center font-black text-sm text-orange-primary">
                            {delivery.nome_cliente ? delivery.nome_cliente[0] : '?'}
                          </div>
                          <div>
                            <h4 className="text-sm font-black tracking-tight">{delivery.nome_cliente || 'Cliente'}</h4>
                            <p className="text-[10px] text-gray-600 font-black uppercase flex items-center gap-1 tracking-widest">
                              <Clock size={10} /> {new Date(delivery.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[14px] font-black text-lime-500 tracking-tighter">R$ {parseFloat(delivery.valor_frete).toFixed(2)}</p>
                          <p className="text-[8px] font-bold text-gray-700 uppercase tracking-widest">Frete</p>
                        </div>
                      </div>

                      <div className="space-y-4 mb-6">
                        <div className="bg-black/20 p-4 rounded-2xl space-y-3 border border-white/5">
                          <div>
                            <p className="text-[8px] text-lime-500 font-black uppercase tracking-widest mb-1">📍 Endereço de Entrega</p>
                            <p className="text-[11px] text-gray-300 font-bold leading-tight">{delivery.endereco_cliente.join(', ') || 'N/A'}</p>
                          </div>
                          <div className="pt-2 border-t border-white/5">
                            <p className="text-[8px] text-orange-primary font-black uppercase tracking-widest mb-1">🏠 Retirada na Loja</p>
                            <p className="text-[10px] text-gray-500 font-medium leading-tight">{store.endereco || store.nome}</p>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setAssigningPath(assigningPath?.storeIndex === sIdx && assigningPath?.deliveryIndex === dIdx ? null : { storeIndex: sIdx, deliveryIndex: dIdx })}
                        className={`w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${assigningPath?.storeIndex === sIdx && assigningPath?.deliveryIndex === dIdx
                          ? 'bg-white/5 text-white border border-white/10'
                          : 'bg-white/[0.03] border border-orange-primary/20 text-orange-primary hover:bg-orange-primary/5'
                          }`}
                      >
                        <UserPlus size={16} />
                        {assigningPath?.storeIndex === sIdx && assigningPath?.deliveryIndex === dIdx ? 'Cancelar' : 'Atribuir Agora'}
                      </button>
                    </div>

                    {assigningPath?.storeIndex === sIdx && assigningPath?.deliveryIndex === dIdx && (
                      <div className="bg-black/40 border-t border-white/5 p-4 space-y-2 animate-fade">
                        <p className="text-[9px] font-black text-gray-700 uppercase tracking-widest px-1 mb-2">Disponíveis</p>

                        <button onClick={() => handleAssign(store, dIdx, null)} className="w-full flex items-center justify-between p-3 rounded-2xl bg-orange-primary/5 border border-orange-primary/20">
                          <div className="flex items-center gap-3 text-left">
                            <div className="w-9 h-9 rounded-lg bg-orange-primary flex items-center justify-center"><CheckCircle size={18} className="text-white" /></div>
                            <div>
                              <p className="text-[11px] font-black text-white">Eu vou entregar</p>
                              <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">Admin Responsável</p>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-orange-primary" />
                        </button>

                        <div className="h-px bg-white/5 my-1" />

                        {drivers.filter(d => d.disponivel).map(driver => (
                          <button key={driver.id} onClick={() => handleAssign(store, dIdx, driver)} className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all group">
                            <div className="flex items-center gap-3 text-left">
                              <img src={driver.foto_url || `https://picsum.photos/seed/${driver.id}/100/100`} className="w-9 h-9 rounded-lg object-cover" alt="" />
                              <div>
                                <p className="text-[11px] font-black text-gray-300 group-hover:text-white">{driver.nome}</p>
                                <p className="text-[8px] text-lime-500 font-bold uppercase tracking-widest">{driver.moto_modelo}</p>
                              </div>
                            </div>
                            <ChevronRight size={16} className="text-gray-800 group-hover:text-orange-primary" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
};

export default DeliveriesInbox;
