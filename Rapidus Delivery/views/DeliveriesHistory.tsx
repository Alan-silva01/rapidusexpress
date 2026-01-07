import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Search, Calendar, ChevronLeft, Loader2, Package } from 'lucide-react';

interface DeliveriesHistoryProps {
    profileId: string;
    onBack: () => void;
}

const DeliveriesHistory: React.FC<DeliveriesHistoryProps> = ({ profileId, onBack }) => {
    const [deliveries, setDeliveries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchHistory();
    }, [dateStart, dateEnd, searchTerm]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('entregas')
                .select('*, estabelecimentos(nome)')
                .eq('entregador_id', profileId)
                .eq('status', 'finalizada')
                .order('criado_at', { ascending: false });

            if (dateStart) query = query.gte('criado_at', dateStart);
            if (dateEnd) query = query.lte('criado_at', dateEnd + 'T23:59:59');
            if (searchTerm) {
                query = query.or(`nome_cliente.ilike.%${searchTerm}%,observacao.ilike.%${searchTerm}%`);
            }

            const { data, error } = await query;
            if (error) throw error;
            setDeliveries(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade pb-24">
            <header className="flex items-center gap-4">
                <button onClick={onBack} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-500 hover:text-white transition-colors">
                    <ChevronLeft size={20} />
                </button>
                <div>
                    <h1 className="text-xl font-black uppercase tracking-tighter">Histórico Total</h1>
                    <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Todas as suas entregas</p>
                </div>
            </header>

            {/* Filters */}
            <div className="space-y-3">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-12 bg-[#0A0A0A] rounded-2xl pl-11 pr-4 text-xs font-bold border border-white/5 outline-none focus:border-orange-primary/20 transition-all placeholder:text-gray-700"
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="relative bg-white/5 rounded-xl px-3 h-12 flex items-center gap-2 border border-white/5">
                        <Calendar size={14} className="text-gray-600" />
                        <input
                            type="date"
                            value={dateStart}
                            onChange={(e) => setDateStart(e.target.value)}
                            className="bg-transparent text-[10px] font-bold text-white outline-none w-full appearance-none"
                        />
                    </div>
                    <div className="relative bg-white/5 rounded-xl px-3 h-12 flex items-center gap-2 border border-white/5">
                        <Calendar size={14} className="text-gray-600" />
                        <input
                            type="date"
                            value={dateEnd}
                            onChange={(e) => setDateEnd(e.target.value)}
                            className="bg-transparent text-[10px] font-bold text-white outline-none w-full appearance-none"
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-primary" size={32} /></div>
            ) : deliveries.length === 0 ? (
                <div className="text-center py-20">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-800">
                        <Package size={24} />
                    </div>
                    <p className="text-[10px] text-gray-700 font-black uppercase tracking-widest">Nenhuma entrega encontrada</p>
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="flex justify-between px-1 mb-2">
                        <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{deliveries.length} Entregas</span>
                        <span className="text-[9px] font-black text-lime-500 uppercase tracking-widest">Total: R$ {deliveries.reduce((acc, curr) => acc + parseFloat(curr.valor_entregador), 0).toFixed(2)}</span>
                    </div>
                    {deliveries.map(delivery => (
                        <div key={delivery.id} className="glass-card p-4 rounded-2xl flex items-center justify-between">
                            <div>
                                <h4 className="text-xs font-black tracking-tight">{delivery.estabelecimentos?.nome}</h4>
                                <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mt-0.5">
                                    {new Date(delivery.criado_at).toLocaleDateString('pt-BR')} • {delivery.nome_cliente || 'Cliente'}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-black tracking-tighter text-white">R$ {parseFloat(delivery.valor_entregador).toFixed(2)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DeliveriesHistory;
