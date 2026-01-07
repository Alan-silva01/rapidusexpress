
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Table, Plus, Save, Search, ArrowLeft, Loader2, Tag, AlertCircle, CheckCircle2 } from 'lucide-react';

interface PriceTablesProps {
    onBack: () => void;
}

const PriceTables: React.FC<PriceTablesProps> = ({ onBack }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [selectedColumn, setSelectedColumn] = useState<string>('pre_001');
    const [searchTerm, setSearchTerm] = useState('');
    const [newBairro, setNewBairro] = useState('');
    const [showAddBairro, setShowAddBairro] = useState(false);
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: colsData, error: colsError } = await supabase.rpc('get_table_columns', { table_name_input: 'taxas_entrega' });

            let preCols = [];
            if (colsError) {
                const { data: sample } = await supabase.from('taxas_entrega').select('*').limit(1);
                if (sample && sample[0]) {
                    preCols = Object.keys(sample[0]).filter(k => k.startsWith('pre_')).sort();
                } else {
                    preCols = ['pre_001', 'pre_002', 'pre_003', 'pre_004'];
                }
            } else {
                preCols = colsData.map((c: any) => c.column_name).filter((n: string) => n.startsWith('pre_')).sort();
            }
            setColumns(preCols);
            if (!preCols.includes(selectedColumn) && preCols.length > 0) {
                setSelectedColumn(preCols[0]);
            }

            const { data: rows, error: rowsError } = await supabase
                .from('taxas_entrega')
                .select('*')
                .order('bairro');

            if (rowsError) throw rowsError;
            setData(rows || []);
        } catch (err) {
            console.error('Erro ao buscar taxas:', err);
        } finally {
            setLoading(false);
        }
    };

    const showNotify = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleUpdateValue = (id: number, column: string, value: string) => {
        setData(prev => prev.map(row =>
            row.id === id ? { ...row, [column]: value } : row
        ));
    };

    const saveChanges = async () => {
        setSaving(true);
        try {
            for (const row of data) {
                const { id, ...updates } = row;
                await supabase.from('taxas_entrega').update(updates).eq('id', id);
            }
            showNotify('Alterações salvas com sucesso!');
        } catch (err) {
            console.error('Erro ao salvar:', err);
            showNotify('Erro ao salvar alterações.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const addNewColumn = async () => {
        const nextNum = columns.length + 1;
        const nextCol = `pre_${nextNum.toString().padStart(3, '0')}`;

        if (window.confirm(`Deseja criar a nova tabela de preços ${nextCol.toUpperCase()}?`)) {
            setSaving(true);
            try {
                const { error } = await supabase.rpc('add_price_column', { column_name: nextCol });
                if (error) throw error;

                await fetchData();
                setSelectedColumn(nextCol);
                showNotify(`Tabela ${nextCol.toUpperCase()} criada com sucesso!`);
            } catch (err) {
                console.error('Erro ao criar coluna:', err);
                showNotify('Erro ao criar nova coluna.', 'error');
            } finally {
                setSaving(false);
            }
        }
    };

    const addNewBairro = async () => {
        if (!newBairro.trim()) return;
        setSaving(true);
        try {
            const defaultValue: any = { bairro: newBairro.trim() };
            columns.forEach(col => defaultValue[col] = 0);

            const { error } = await supabase.from('taxas_entrega').insert([defaultValue]);
            if (error) throw error;

            setNewBairro('');
            setShowAddBairro(false);
            await fetchData();
            showNotify('Bairro adicionado com sucesso!');
        } catch (err) {
            console.error('Erro ao adicionar bairro:', err);
            showNotify('Erro ao adicionar bairro.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const filteredData = data.filter(row =>
        row.bairro.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 pb-40 animate-fade">
            <header className="flex items-center gap-4">
                <button onClick={onBack} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-xl font-black uppercase tracking-tighter">Gestão de Preços</h1>
                    <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Ajuste por bairro</p>
                </div>
            </header>

            {/* Ações Rápidas */}
            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => setShowAddBairro(true)}
                    className="h-12 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-white/10 transition-all font-inter"
                >
                    <Plus size={16} className="text-orange-primary" /> Novo Bairro
                </button>
                <button
                    onClick={addNewColumn}
                    className="h-12 bg-orange-primary/10 border border-orange-primary/20 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-orange-primary hover:bg-orange-primary/20 transition-all font-inter"
                >
                    <Table size={16} /> Nova Tabela
                </button>
            </div>

            {/* Seletor de Tabela (Abas) */}
            <div className="space-y-2">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">Selecione a Tabela para editar</p>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {columns.map(col => (
                        <button
                            key={col}
                            onClick={() => setSelectedColumn(col)}
                            className={`shrink-0 px-6 h-10 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedColumn === col
                                ? 'bg-orange-primary text-white shadow-lg shadow-orange-primary/20'
                                : 'bg-white/5 text-gray-500 border border-white/5 hover:text-gray-300'}`}
                        >
                            {col.replace('pre_', 'TABELA ')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Busca */}
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700 group-focus-within:text-orange-primary transition-colors" size={16} />
                <input
                    type="text"
                    placeholder="Filtrar por nome do bairro..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-12 bg-[#0A0A0A] rounded-2xl pl-11 pr-4 text-xs font-bold border border-white/5 outline-none focus:border-orange-primary/20 transition-all placeholder:text-gray-700"
                />
            </div>

            {/* Tabela Simplificada */}
            <div className="glass-card rounded-[2.5rem] bg-white/[0.02] border-white/5 overflow-hidden">
                <table className="w-full divide-y divide-white/5">
                    <thead>
                        <tr className="bg-white/[0.03]">
                            <th className="px-6 py-4 text-left text-[9px] font-black text-gray-500 uppercase tracking-widest">Bairro</th>
                            <th className="px-6 py-4 text-right text-[9px] font-black text-orange-primary uppercase tracking-widest">R$ Preço</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-inter">
                        {loading ? (
                            <tr>
                                <td colSpan={2} className="py-20 text-center">
                                    <Loader2 className="animate-spin text-orange-primary mx-auto" size={32} />
                                </td>
                            </tr>
                        ) : filteredData.length === 0 ? (
                            <tr>
                                <td colSpan={2} className="py-12 text-center text-[10px] font-black text-gray-700 uppercase">Nenhum bairro encontrado</td>
                            </tr>
                        ) : (
                            filteredData.map((row) => (
                                <tr key={row.id} className="hover:bg-white/[0.01] transition-colors">
                                    <td className="px-6 py-4 text-[11px] font-black text-gray-400 capitalize">{row.bairro}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="inline-flex items-center gap-2 bg-zinc-900/50 border border-white/5 rounded-xl px-3 h-10 group-focus-within:border-orange-primary/40 transition-all">
                                            <span className="text-[10px] font-black text-gray-600">R$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={row[selectedColumn]}
                                                onChange={(e) => handleUpdateValue(row.id, selectedColumn, e.target.value)}
                                                className="w-16 bg-transparent text-right text-xs font-black text-white outline-none"
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Info Alert - Moved above button area */}
            <div className="bg-sky-500/5 border border-sky-500/10 p-5 rounded-[2rem] flex items-start gap-4">
                <AlertCircle className="text-sky-500 shrink-0" size={18} />
                <div>
                    <p className="text-[10px] font-bold text-sky-500 uppercase tracking-widest mb-1">Dica de Gestão</p>
                    <p className="text-[10px] text-gray-500 leading-relaxed font-black uppercase">Clique nas abas acima para alternar entre as diferentes tabelas de preços de frete.</p>
                </div>
            </div>

            {/* Botão Fixo Salvar */}
            {!loading && data.length > 0 && (
                <div className="fixed bottom-28 left-0 right-0 px-6 py-4 bg-gradient-to-t from-black via-black to-transparent z-[100]">
                    <button
                        onClick={saveChanges}
                        disabled={saving}
                        className="w-full max-w-sm mx-auto h-14 bg-lime-500 hover:bg-lime-600 disabled:opacity-50 text-black rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl shadow-lime-500/20 transition-all"
                    >
                        {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        {saving ? 'Guardando...' : 'Salvar todas as alterações'}
                    </button>
                </div>
            )}

            {/* Modal de Notificação Suceso */}
            {notification && (
                <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[200] animate-bounce">
                    <div className={`px-6 py-3 rounded-2xl flex items-center gap-3 shadow-2xl border ${notification.type === 'success' ? 'bg-lime-500 border-lime-400' : 'bg-red-500 border-red-400'} text-black`}>
                        {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        <span className="text-[10px] font-black uppercase tracking-widest">{notification.message}</span>
                    </div>
                </div>
            )}

            {/* Modal Adicionar Bairro */}
            {showAddBairro && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade">
                    <div className="w-full max-w-sm bg-zinc-950 rounded-[3rem] border border-white/5 p-8 shadow-2xl">
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-1 font-inter">Novo Bairro</h2>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-6 leading-none">Cadastrar área de cobertura</p>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-1 leading-none">Nome do Bairro</p>
                                <input
                                    autoFocus
                                    value={newBairro}
                                    onChange={e => setNewBairro(e.target.value)}
                                    placeholder="Ex: Novo Horizonte"
                                    className="w-full h-12 bg-zinc-900 border border-white/5 rounded-2xl px-4 text-sm font-bold text-white outline-none focus:border-orange-primary/40"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowAddBairro(false)}
                                    className="flex-1 h-12 bg-white/5 text-gray-500 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={addNewBairro}
                                    disabled={saving || !newBairro}
                                    className="flex-1 h-12 bg-orange-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest"
                                >
                                    Adicionar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PriceTables;
