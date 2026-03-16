
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Inbox, ChevronRight, UserPlus, MapPin, CreditCard, Clock, Loader2, CheckCircle, Phone, CheckSquare, Square, X } from 'lucide-react';
import { Perfil } from '../types';
import Modal from '../components/Modal';

interface PendingDelivery {
  data_hora: string;
  valor_frete: string;
  nome_cliente: string;
  telefone_cliente?: string;
  endereco_cliente: string[];
}

interface DeliveriesInboxProps {
  onAssignSuccess?: (view: any) => void;
  profile?: Perfil | null;
}

const DeliveriesInbox: React.FC<DeliveriesInboxProps> = ({ onAssignSuccess, profile }) => {
  const [stores, setStores] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningPath, setAssigningPath] = useState<{ storeIndex: number, deliveryIndex: number } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [modal, setModal] = useState<{ isOpen: boolean; type: 'success' | 'warning' | 'info' | 'driver' | 'admin'; title: string; message?: string; driverName?: string } | null>(null);
  const [editingAddress, setEditingAddress] = useState<{ store: any; dIdx: number; isDb: boolean; id: string | null; currentAddress: string } | null>(null);
  const [tempAddress, setTempAddress] = useState('');

  // Multi-select states
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAssigning, setBatchAssigning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    fetchInboxData();

    const channel = supabase
      .channel('inbox_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => {
        fetchInboxData(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entregas' }, () => {
        fetchInboxData(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchInboxData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Buscar estabelecimentos, clientes (JSON) e entregas recusadas (tabela relational)
      const { data: estData } = await supabase.from('estabelecimentos').select('*');
      const { data: clientData } = await supabase.from('clientes').select('numero, entregas');
      const { data: driverData } = await supabase.from('perfis').select('*').eq('funcao', 'entregador');
      const { data: refusedData } = await supabase.from('entregas').select('*').eq('status', 'aguardando');

      // Fetch active deliveries count per driver
      const { data: activeDeliveries } = await supabase
        .from('entregas')
        .select('entregador_id')
        .in('status', ['atribuida', 'aceita', 'em_rota', 'coletada']);

      // Count deliveries per driver
      const deliveryCountByDriver: Record<string, number> = {};
      (activeDeliveries || []).forEach((d: any) => {
        if (d.entregador_id) {
          deliveryCountByDriver[d.entregador_id] = (deliveryCountByDriver[d.entregador_id] || 0) + 1;
        }
      });

      // Add count to each driver
      const driversWithCount = (driverData || []).map(driver => ({
        ...driver,
        activeDeliveriesCount: deliveryCountByDriver[driver.id] || 0
      }));

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
            telefone_cliente: d.telefone_cliente,
            endereco_cliente: Array.isArray(d.endereco_cliente) ? d.endereco_cliente : [d.endereco_cliente].filter(Boolean),
            isFromDB: true
          }));

        // Formatar entregas do JSON com fallbacks
        const formattedJsonDeliveries = jsonDeliveries.map((d: any, index: number) => {
          const obs = d.observacao || d.observacoes || '';

          // Prioridade 1: Campo endereco_cliente (vinda do n8n ou manual)
          let finalAddress = [];
          if (Array.isArray(d.endereco_cliente)) {
            finalAddress = d.endereco_cliente;
          } else if (typeof d.endereco_cliente === 'string' && d.endereco_cliente) {
            finalAddress = [d.endereco_cliente];
          }
          // Prioridade 2: Objeto endereco antigo
          else {
            const addr = d.endereco || {};
            finalAddress = [addr.rua, addr.numero, addr.bairro, addr.cidade].filter(Boolean);
          }

          // Se ainda estiver vazio, tentar pegar da observação
          if (finalAddress.length === 0 && obs) {
            finalAddress = [obs.replace('Extraída do WhatsApp: ', '')];
          }

          return {
            ...d,
            nome_cliente: d.nome_cliente || d.nome || (obs.length < 40 ? obs.replace('Extraída do WhatsApp: ', '') : 'Cliente'),
            telefone_cliente: d.telefone_cliente || d.telefone,
            endereco_cliente: finalAddress.length > 0 ? finalAddress : ['N/A'],
            isFromDB: false,
            originalIndex: index // Guarda o índice original do array JSON
          };
        });

        // Deduplicar: se a entrega já está no banco (refusedData), removemos do JSON para não aparecer 2 vezes
        const filteredJsonDeliveries = formattedJsonDeliveries.filter(jd => {
          const isInDb = formattedDbDeliveries.some(dbd =>
            dbd.endereco_cliente.join('|') === jd.endereco_cliente.join('|') &&
            (dbd.data_hora === jd.data_hora || Math.abs(new Date(dbd.data_hora).getTime() - new Date(jd.data_hora).getTime()) < 60000)
          );
          return !isInDb;
        });

        // Unificar e Ordenar por Data (Mais antigos primeiro - pedido do user)
        const allDeliveries = [...filteredJsonDeliveries, ...formattedDbDeliveries].sort((a, b) => {
          return new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime();
        });

        return {
          ...store,
          entregas: allDeliveries
        };
      });

      setStores(storesWithDeliveries);
      setDrivers(driversWithCount);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Get total delivery count across all stores
  const totalDeliveries = stores.reduce((sum, s) => sum + (s.entregas?.length || 0), 0);

  // Toggle selection of an individual delivery
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all deliveries
  const selectAll = () => {
    const allIds = new Set<string>();
    stores.forEach((store, sIdx) => {
      store.entregas?.forEach((_: any, dIdx: number) => {
        allIds.add(`${sIdx}-${dIdx}`);
      });
    });
    setSelectedIds(allIds);
  };

  // Clear all selections and exit selection mode
  const clearSelection = () => {
    setSelectedIds(new Set());
    setBatchAssigning(false);
  };

  // Exit selection mode entirely
  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setBatchAssigning(false);
    setAssigningPath(null);
  };

  const handleAssign = async (store: any, deliveryIndex: number, driver: any) => {
    const delivery = store.entregas[deliveryIndex];
    if (driver && !driver.disponivel) {
      alert('Este entregador ficou indisponível no momento. Por favor, escolha outro.');
      await fetchInboxData();
      return;
    }

    setProcessing(true);
    try {
      const effectiveDriverId = driver?.id || profile?.id || null;

      // Lógica de comissão refinada:
      // 1. Se driver tem porcentagem definida (mesmo que 0), usa ela. (Usa ?? em vez de ||)
      // 2. Se não tem porcentagem, mas tem valor fixo > 0, assume 0% de comissão.
      // 3. Se não tem nada, assume padrão 20%.
      const commissionPct = driver?.porcentagem_lucro_admin ?? ((driver?.valor_fixo_admin && driver?.valor_fixo_admin > 0) ? 0 : 20);
      const commissionFixed = driver?.valor_fixo_admin || 0;

      if ((delivery as any).isFromDB) {
        const { error } = await supabase.rpc('atribuir_entrega_existente', {
          p_entrega_id: (delivery as any).id,
          p_entregador_id: effectiveDriverId,
          p_porcentagem_admin: commissionPct,
          p_valor_fixo_admin: commissionFixed
        });
        if (error) throw error;
      } else {
        // Usa o originalIndex salvo anteriormente, pois deliveryIndex é apenas visual da lista ordenada
        const jsonIndex = (delivery as any).originalIndex;

        if (jsonIndex === undefined || jsonIndex === null) {
          throw new Error('Índice original da entrega não encontrado.');
        }

        const { error } = await supabase.rpc('atribuir_entrega_do_json', {
          p_cliente_numero: store.numero_whatsapp,
          p_json_index: jsonIndex,
          p_entregador_id: effectiveDriverId,
          p_porcentagem_admin: commissionPct,
          p_valor_fixo_admin: commissionFixed
        });
        if (error) throw error;
      }

      // Notificações para o motorista são tratadas via n8n (webhook abaixo), não via push direto do site.
      if (driver && driver.id) {
        // Send data to n8n webhook for driver notification
        try {
          await fetch('https://rapidus-n8n-webhook.b7bsm5.easypanel.host/webhook/notificar_entregador', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entregador_id: driver.id,
              entregador_nome: driver.nome,
              estabelecimento: store.nome_estabelecimento || store.numero_whatsapp,
              valor_frete: parseFloat(delivery.valor_frete) || 0,
              endereco_cliente: delivery.endereco_cliente || [],
              nome_cliente: delivery.nome_cliente || (delivery as any).nome || 'Cliente',
              telefone_cliente: delivery.telefone_cliente || (delivery as any).telefone || (delivery as any).contato || 'N/A',
              observacao: delivery.observacao || (delivery as any).observacoes || ''
            })
          });
          console.log('📤 Webhook n8n notificado com dados completos:', driver.nome);
        } catch (webhookErr) {
          console.warn('n8n webhook failed (non-fatal):', webhookErr);
        }
      }

      // Auto-aceite para o Admin
      if (!driver) {
        let deliveryId = (delivery as any).id;
        if (!deliveryId) {
          const { data: newData } = await supabase
            .from('entregas')
            .select('id')
            .eq('estabelecimento_id', store.id)
            .eq('entregador_id', effectiveDriverId)
            .eq('status', 'atribuida')
            .order('criado_at', { ascending: false })
            .limit(1)
            .single();
          deliveryId = newData?.id;
        }

        if (deliveryId) {
          await supabase.from('entregas').update({ status: 'em_rota' }).eq('id', deliveryId);
        }
      }

      setAssigningPath(null);
      await fetchInboxData();

      if (driver) {
        setModal({
          isOpen: true,
          type: 'driver',
          title: 'Entrega Enviada!',
          message: `A entrega foi atribuída para ${driver.nome}. Ele será notificado imediatamente e poderá aceitar ou recusar.`,
          driverName: driver.nome
        });
      } else {
        setModal({
          isOpen: true,
          type: 'admin',
          title: 'Entrega Assumida!',
          message: 'Você assumiu esta entrega. Agora pode ir até a loja coletar o pedido e realizar a entrega.',
        });
        if (onAssignSuccess) {
          setTimeout(() => onAssignSuccess('self_delivery'), 1500);
        }
      }
    } catch (err: any) {
      alert('Erro ao atribuir: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateValue = async (store: any, index: number, isDb: boolean, deliveryId: string | null, newValue: string) => {
    const numericValue = parseFloat(newValue.replace(',', '.'));
    if (isNaN(numericValue) || numericValue < 0) {
      alert('Valor inválido');
      return;
    }

    setLoading(true);
    try {
      if (isDb && deliveryId) {
        const { error } = await supabase
          .from('entregas')
          .update({ valor_total: numericValue }) // O trigger ou a query deve cuidar do resto se necessário, mas aqui atualizamos o base
          .eq('id', deliveryId);

        if (error) throw error;
      } else {
        const delivery = store.entregas[index];
        const jsonIndex = delivery.originalIndex;
        if (jsonIndex === undefined || jsonIndex === null) {
          throw new Error('Índice original da entrega não encontrado.');
        }

        const { error } = await supabase.rpc('editar_valor_entrega_json', {
          p_cliente_numero: store.numero_whatsapp,
          p_json_index: jsonIndex,
          p_novo_valor: numericValue
        });
        if (error) throw error;
      }
      await fetchInboxData(true);
    } catch (err: any) {
      alert('Erro ao atualizar valor: ' + err.message);
    } finally {
      setLoading(false);
      setModal(null); // Fechar qualquer modal de edição se houver (vamos usar prompt simples por enquanto ou modal customizado depois)
    }
  };

  const handleUpdateAddress = async (store: any, index: number, isDb: boolean, deliveryId: string | null, newAddress: string) => {
    if (!newAddress.trim()) {
      alert('Endereço inválido');
      return;
    }

    setLoading(true);
    try {
      const addressArray = [newAddress.trim()];
      if (isDb && deliveryId) {
        const { error } = await supabase
          .from('entregas')
          .update({ endereco_cliente: addressArray })
          .eq('id', deliveryId);

        if (error) throw error;
      } else {
        const delivery = store.entregas[index];
        const jsonIndex = delivery.originalIndex;
        if (jsonIndex === undefined || jsonIndex === null) {
          throw new Error('Índice original da entrega não encontrado.');
        }

        const { error } = await supabase.rpc('editar_endereco_entrega_json', {
          p_cliente_numero: store.numero_whatsapp,
          p_json_index: jsonIndex,
          p_novo_endereco: addressArray
        });
        if (error) throw error;
      }
      await fetchInboxData(true);
      setEditingAddress(null);
      setModal({
        isOpen: true,
        type: 'success',
        title: 'Sucesso!',
        message: 'O endereço de entrega foi atualizado com sucesso.'
      });
    } catch (err: any) {
      alert('Erro ao atualizar endereço: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (store: any, index: number, isDb: boolean, deliveryId: string | null) => {
    if (!confirm('Tem certeza que deseja EXCLUIR esta entrega permanentemente?')) return;

    setLoading(true);
    try {
      if (isDb && deliveryId) {
        const { error } = await supabase
          .from('entregas')
          .delete()
          .eq('id', deliveryId);
        if (error) throw error;
      } else {
        const delivery = store.entregas[index];
        const jsonIndex = delivery.originalIndex;
        if (jsonIndex === undefined || jsonIndex === null) {
          throw new Error('Índice original da entrega não encontrado.');
        }

        const { error } = await supabase.rpc('excluir_entrega_do_json', {
          p_cliente_numero: store.numero_whatsapp,
          p_json_index: jsonIndex
        });
        if (error) throw error;
      }
      await fetchInboxData(true);
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Batch assign all selected deliveries
  const handleBatchAssign = async (driver: any) => {
    if (driver && !driver.disponivel) {
      alert('Este entregador ficou indisponível no momento. Por favor, escolha outro.');
      await fetchInboxData();
      return;
    }

    setProcessing(true);
    const total = selectedIds.size;
    let current = 0;
    let errors = 0;

    // Sort selected IDs to process in reverse order (highest index first per store)
    // This prevents index shifting when removing JSON items
    const sortedIds = Array.from(selectedIds).sort((a, b) => {
      const [sA, dA] = a.split('-').map(Number);
      const [sB, dB] = b.split('-').map(Number);
      if (sA !== sB) return sB - sA;
      return dB - dA; // reverse order within same store
    });

    try {
      for (const id of sortedIds) {
        const [sIdx, dIdx] = id.split('-').map(Number);
        const store = stores[sIdx];
        if (!store || !store.entregas?.[dIdx]) {
          errors++;
          current++;
          setBatchProgress({ current, total });
          continue;
        }

        const delivery = store.entregas[dIdx];
        const effectiveDriverId = driver?.id || profile?.id || null;

        try {
          if ((delivery as any).isFromDB) {
            const { error } = await supabase.rpc('atribuir_entrega_existente', {
              p_entrega_id: (delivery as any).id,
              p_entregador_id: effectiveDriverId,
              p_porcentagem_admin: driver?.porcentagem_lucro_admin || 20,
              p_valor_fixo_admin: driver?.valor_fixo_admin || 0
            });
            if (error) throw error;
          } else {
            const { error } = await supabase.rpc('atribuir_entrega_do_json', {
              p_cliente_numero: store.numero_whatsapp,
              p_json_index: dIdx,
              p_entregador_id: effectiveDriverId,
              p_porcentagem_admin: driver?.porcentagem_lucro_admin || 20,
              p_valor_fixo_admin: driver?.valor_fixo_admin || 0
            });
            if (error) throw error;
          }

          // Notify driver via n8n webhook
          if (driver && driver.id) {
            try {
              await fetch('https://rapidus-n8n-webhook.b7bsm5.easypanel.host/webhook/notificar_entregador', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  entregador_id: driver.id,
                  entregador_nome: driver.nome,
                  estabelecimento: store.nome_estabelecimento || store.numero_whatsapp,
                  valor_frete: parseFloat(delivery.valor_frete) || 0,
                  endereco_cliente: delivery.endereco_cliente || [],
                  nome_cliente: delivery.nome_cliente || (delivery as any).nome || 'Cliente',
                  telefone_cliente: delivery.telefone_cliente || (delivery as any).telefone || (delivery as any).contato || 'N/A',
                  observacao: delivery.observacao || (delivery as any).observacoes || ''
                })
              });
            } catch (webhookErr) {
              console.warn('n8n webhook failed (non-fatal):', webhookErr);
            }
          }

          // Auto-aceite para Admin
          if (!driver) {
            let deliveryId = (delivery as any).id;
            if (!deliveryId) {
              const { data: newData } = await supabase
                .from('entregas')
                .select('id')
                .eq('estabelecimento_id', store.id)
                .eq('entregador_id', effectiveDriverId)
                .eq('status', 'atribuida')
                .order('criado_at', { ascending: false })
                .limit(1)
                .single();
              deliveryId = newData?.id;
            }
            if (deliveryId) {
              await supabase.from('entregas').update({ status: 'em_rota' }).eq('id', deliveryId);
            }
          }
        } catch (err) {
          console.error('Batch assign error for item:', id, err);
          errors++;
        }

        current++;
        setBatchProgress({ current, total });
      }

      // Clean up and refresh
      exitSelectionMode();
      await fetchInboxData();
      setBatchProgress(null);

      const successCount = total - errors;

      if (driver) {
        setModal({
          isOpen: true,
          type: 'driver',
          title: `${successCount} Entrega${successCount > 1 ? 's' : ''} Enviada${successCount > 1 ? 's' : ''}!`,
          message: `${successCount} entrega${successCount > 1 ? 's foram atribuídas' : ' foi atribuída'} para ${driver.nome}. Ele será notificado imediatamente.${errors > 0 ? ` (${errors} erro${errors > 1 ? 's' : ''})` : ''}`,
          driverName: driver.nome
        });
      } else {
        setModal({
          isOpen: true,
          type: 'admin',
          title: `${successCount} Entrega${successCount > 1 ? 's' : ''} Assumida${successCount > 1 ? 's' : ''}!`,
          message: `Você assumiu ${successCount} entrega${successCount > 1 ? 's' : ''}. Agora pode ir até as lojas coletar os pedidos.${errors > 0 ? ` (${errors} erro${errors > 1 ? 's' : ''})` : ''}`,
        });
        if (onAssignSuccess) {
          setTimeout(() => onAssignSuccess('self_delivery'), 1500);
        }
      }
    } catch (err: any) {
      alert('Erro ao atribuir em lote: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tighter">Pedidos Pendentes</h1>
          <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Aguardando atribuição</p>
        </div>
        {totalDeliveries > 0 && (
          <button
            onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
            className={`h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
              selectionMode
                ? 'bg-orange-primary text-white shadow-lg shadow-orange-primary/20'
                : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20'
            }`}
          >
            {selectionMode ? <><X size={14} /> Cancelar</> : <><CheckSquare size={14} /> Selecionar</>}
          </button>
        )}
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

                {store.entregas.map((delivery: PendingDelivery, dIdx: number) => {
                  const selectionId = `${sIdx}-${dIdx}`;
                  const isSelected = selectedIds.has(selectionId);

                  return (
                    <div
                      key={`${store.id}-${dIdx}`}
                      className={`glass-card rounded-3xl overflow-hidden transition-all duration-200 ${
                        selectionMode && isSelected
                          ? 'border-orange-primary/50 ring-1 ring-orange-primary/30'
                          : 'border-white/5'
                      }`}
                    >
                      <div className="p-5">
                        <div className="flex justify-between items-start mb-5">
                          <div className="flex items-center gap-4">
                            {/* Checkbox quando em modo seleção */}
                            {selectionMode && (
                              <button
                                onClick={() => toggleSelection(selectionId)}
                                className="transition-all duration-200"
                              >
                                {isSelected ? (
                                  <div className="w-7 h-7 rounded-lg bg-orange-primary flex items-center justify-center shadow-lg shadow-orange-primary/30">
                                    <CheckCircle size={16} className="text-white" />
                                  </div>
                                ) : (
                                  <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:border-orange-primary/30">
                                    <Square size={16} className="text-gray-700" />
                                  </div>
                                )}
                              </button>
                            )}
                            <div
                              className={`w-11 h-11 bg-orange-primary/10 rounded-xl flex items-center justify-center font-black text-sm text-orange-primary ${selectionMode ? 'cursor-pointer' : ''}`}
                              onClick={() => selectionMode && toggleSelection(selectionId)}
                            >
                              {delivery.nome_cliente ? delivery.nome_cliente[0] : '?'}
                            </div>
                            
                            <div
                              className={selectionMode ? 'cursor-pointer' : ''}
                              onClick={() => selectionMode && toggleSelection(selectionId)}
                            >
                              <h4 className="text-sm font-black tracking-tight">{delivery.nome_cliente || 'Cliente'}</h4>
                              <div className="flex items-center gap-3">
                                <p className="text-[10px] text-gray-600 font-black uppercase flex items-center gap-1 tracking-widest">
                                  <Clock size={10} /> {new Date(delivery.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                {delivery.telefone_cliente && (
                                  <a
                                    href={`tel:${delivery.telefone_cliente.replace(/\D/g, '')}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[10px] text-lime-500 font-black uppercase flex items-center gap-1 tracking-widest hover:text-lime-400 transition-colors"
                                  >
                                    <Phone size={10} /> {delivery.telefone_cliente}
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-2">
                                <p className="text-[14px] font-black text-lime-500 tracking-tighter">R$ {parseFloat(delivery.valor_frete).toFixed(2)}</p>
                                <button
                                  onClick={() => {
                                    const novoValor = prompt('Novo valor do frete:', delivery.valor_frete);
                                    if (novoValor) handleUpdateValue(store, dIdx, (delivery as any).isFromDB, (delivery as any).id, novoValor);
                                  }}
                                  className="p-1 hover:bg-white/10 rounded-full transition-colors"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 hover:text-white"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                {(delivery as any).recusada ? (
                                  <p className="text-[8px] font-black text-red-500 uppercase tracking-widest animate-pulse">RECUSADA</p>
                                ) : (
                                  <p className="text-[8px] font-bold text-gray-700 uppercase tracking-widest">Frete</p>
                                )}
                                <button
                                  onClick={() => handleDelete(store, dIdx, (delivery as any).isFromDB, (delivery as any).id)}
                                  className="p-1 hover:bg-red-500/10 rounded-full transition-colors group"
                                  title="Excluir entrega"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 group-hover:text-red-500">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                      <div className="space-y-4 mb-6">
                        <div className="bg-black/20 p-4 rounded-2xl space-y-3 border border-white/5">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[8px] text-lime-500 font-black uppercase tracking-widest">📍 Endereço de Entrega</p>
                              {profile?.funcao === 'admin' && (
                                <button
                                  onClick={() => {
                                    const addr = delivery.endereco_cliente.join(', ');
                                    setTempAddress(addr);
                                    setEditingAddress({
                                      store,
                                      dIdx,
                                      isDb: (delivery as any).isFromDB,
                                      id: (delivery as any).id,
                                      currentAddress: addr
                                    });
                                  }}
                                  className="p-1 hover:bg-white/10 rounded-full transition-colors"
                                  title="Editar endereço"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 hover:text-white"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                </button>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-300 font-bold leading-tight">{delivery.endereco_cliente.join(', ') || 'N/A'}</p>
                          </div>
                          <div className="pt-2 border-t border-white/5">
                            <p className="text-[8px] text-orange-primary font-black uppercase tracking-widest mb-1">🏠 Retirada na Loja</p>
                            <p className="text-[10px] text-gray-500 font-medium leading-tight">{store.endereco || store.nome}</p>
                          </div>
                        </div>
                      </div>

                      {/* Botão individual de atribuir (só aparece fora do modo seleção) */}
                      {!selectionMode && (
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
                      )}
                    </div>

                    {/* Painel individual de motoristas */}
                    {!selectionMode && assigningPath?.storeIndex === sIdx && assigningPath?.deliveryIndex === dIdx && (
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
                                <div className="flex items-center gap-2">
                                  <p className="text-[8px] text-lime-500 font-bold uppercase tracking-widest">{driver.moto_modelo}</p>
                                  {driver.activeDeliveriesCount > 0 && (
                                    <span className="text-[8px] font-black text-orange-primary bg-orange-primary/10 px-1.5 py-0.5 rounded-md">
                                      {driver.activeDeliveriesCount} {driver.activeDeliveriesCount === 1 ? 'entrega' : 'entregas'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <ChevronRight size={16} className="text-gray-800 group-hover:text-orange-primary" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )
          ))}
        </div>
      )}

      {/* Barra flutuante de seleção múltipla */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-50 px-4 animate-fade">
          <div className="glass-card rounded-3xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden" style={{ backdropFilter: 'blur(20px)', background: 'rgba(10,10,10,0.95)' }}>
            {/* Info bar */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-primary rounded-xl flex items-center justify-center font-black text-sm text-white shadow-lg shadow-orange-primary/30">
                  {selectedIds.size}
                </div>
                <div>
                  <p className="text-xs font-black text-white">
                    {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
                  </p>
                  <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">
                    R$ {Array.from(selectedIds).reduce((sum, id) => {
                      const [sIdx, dIdx] = id.split('-').map(Number);
                      const val = parseFloat(stores[sIdx]?.entregas?.[dIdx]?.valor_frete || '0');
                      return sum + val;
                    }, 0).toFixed(2)} total
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectedIds.size === totalDeliveries ? clearSelection : selectAll}
                  className="h-8 px-3 rounded-lg text-[8px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all"
                >
                  {selectedIds.size === totalDeliveries ? 'Limpar' : 'Todos'}
                </button>
              </div>
            </div>

            {/* Batch assign button or driver list */}
            {!batchAssigning ? (
              <div className="px-4 pb-4">
                <button
                  onClick={() => setBatchAssigning(true)}
                  disabled={processing}
                  className="w-full h-14 bg-orange-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-orange-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {batchProgress ? `Atribuindo ${batchProgress.current}/${batchProgress.total}...` : 'Processando...'}
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      Atribuir {selectedIds.size} Selecionado{selectedIds.size > 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="border-t border-white/5 p-4 space-y-2 animate-fade max-h-60 overflow-y-auto">
                <p className="text-[9px] font-black text-gray-700 uppercase tracking-widest px-1 mb-2">Atribuir para:</p>

                <button
                  onClick={() => handleBatchAssign(null)}
                  disabled={processing}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-orange-primary/5 border border-orange-primary/20 disabled:opacity-50"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-9 h-9 rounded-lg bg-orange-primary flex items-center justify-center"><CheckCircle size={18} className="text-white" /></div>
                    <div>
                      <p className="text-[11px] font-black text-white">Eu vou entregar</p>
                      <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">Admin Responsável</p>
                    </div>
                  </div>
                  {processing ? <Loader2 size={16} className="animate-spin text-orange-primary" /> : <ChevronRight size={16} className="text-orange-primary" />}
                </button>

                <div className="h-px bg-white/5 my-1" />

                {drivers.filter(d => d.disponivel).map(driver => (
                  <button
                    key={driver.id}
                    onClick={() => handleBatchAssign(driver)}
                    disabled={processing}
                    className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3 text-left">
                      <img src={driver.foto_url || `https://picsum.photos/seed/${driver.id}/100/100`} className="w-9 h-9 rounded-lg object-cover" alt="" />
                      <div>
                        <p className="text-[11px] font-black text-gray-300 group-hover:text-white">{driver.nome}</p>
                        <p className="text-[8px] text-lime-500 font-bold uppercase tracking-widest">{driver.moto_modelo}</p>
                      </div>
                    </div>
                    {processing ? <Loader2 size={16} className="animate-spin text-gray-600" /> : <ChevronRight size={16} className="text-gray-800 group-hover:text-orange-primary" />}
                  </button>
                ))}

                <button
                  onClick={() => setBatchAssigning(false)}
                  className="w-full h-10 rounded-xl text-[9px] font-black uppercase tracking-widest text-gray-600 hover:text-white transition-all"
                >
                  Voltar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de confirmação / Mensagens */}
      {modal && (
        <Modal
          isOpen={modal.isOpen}
          onClose={() => setModal(null)}
          type={modal.type}
          title={modal.title}
          message={modal.message}
          primaryAction={{
            label: 'Entendido',
            onClick: () => setModal(null)
          }}
        />
      )}

      {/* Modal de Edição de Endereço */}
      {editingAddress && (
        <Modal
          isOpen={!!editingAddress}
          onClose={() => setEditingAddress(null)}
          type="info"
          title="Editar Endereço"
          primaryAction={{
            label: 'Salvar Alteração',
            onClick: () => handleUpdateAddress(
              editingAddress.store,
              editingAddress.dIdx,
              editingAddress.isDb,
              editingAddress.id,
              tempAddress
            )
          }}
          secondaryAction={{
            label: 'Cancelar',
            onClick: () => setEditingAddress(null)
          }}
        >
          <div className="space-y-4">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest px-1">Novo endereço completo</p>
            <textarea
              value={tempAddress}
              onChange={(e) => setTempAddress(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-medium text-white focus:outline-none focus:border-orange-primary/50 transition-all min-h-[100px] resize-none"
              placeholder="Digite o novo endereço..."
              autoFocus
            />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DeliveriesInbox;
