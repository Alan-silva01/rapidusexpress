
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Table, Plus, Save, Trash2, Search, ArrowLeft, Loader2, Tag, AlertCircle } from 'lucide-react';

interface PriceTablesProps {
    onBack: () => void;
}

const PriceTables: React.FC<PriceTablesProps> = ({ onBack }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [newBairro, setNewBairro] = useState('');
    const [showAddBairro, setShowAddBairro] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Buscar colunas da tabela
            const { data: colsData, error: colsError } = await supabase.rpc('get_table_columns', { table_name_input: 'taxas_entrega' });

            if (colsError) {
                // Fallback se a função RPC não existir
                console.warn('RPC get_table_columns não encontrada, usando nomes padrão');
                const { data: sample } = await supabase.from('taxas_entrega').select('*').limit(1);
                if (sample && sample[0]) {
                    setColumns(Object.keys(sample[0]).filter(k => k.startsWith('pre_')).sort());
                } else {
                    setColumns(['pre_001', 'pre_002', 'pre_003', 'pre_004']);
                }
            } else {
                const preCols = colsData.map((c: any) => c.column_name).filter((n: string) => n.startsWith('pre_')).sort();
                setColumns(preCols);
            }

            // Buscar dados
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
            alert('Alterações salvas com sucesso!');
        } catch (err) {
            console.error('Erro ao salvar:', err);
            alert('Erro ao salvar alterações.');
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
                alert(`Tabela ${nextCol.toUpperCase()} criada com sucesso!`);
            } catch (err) {
                console.error('Erro ao criar coluna:', err);
                alert('Erro ao criar nova coluna. Verifique as permissões do banco.');
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
        } catch (err) {
            console.error('Erro ao adicionar bairro:', err);
        } finally {
            setSaving(false);
        }
    };

    const filteredData = data.filter(row =>
        row.bairro.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 pb-24 animate-fade">
            <header className="flex items-center gap-4">
                <button onClick={onBack} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-xl font-black uppercase tracking-tighter">Gestão de Preços</h1>
                    <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Taxas por Bairro e Tabela</p>
                </div>
            </header>

            {/* Ações Rápidas */}
            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => setShowAddBairro(true)}
                    className="h-12 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-white/10 transition-all"
                >
                    <Plus size={16} className="text-orange-primary" /> Novo Bairro
                </button>
                <button
                    onClick={addNewColumn}
                    className="h-12 bg-orange-primary/10 border border-orange-primary/20 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-orange-primary hover:bg-orange-primary/20 transition-all"
                >
                    <Table size={16} /> Nova Tabela
                </button>
            </div>

            {/* Busca */}
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700 group-focus-within:text-orange-primary transition-colors" size={16} />
                <input
                    type="text"
                    placeholder="Buscar bairro..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-12 bg-[#0A0A0A] rounded-2xl pl-11 pr-4 text-xs font-bold border border-white/5 outline-none focus:border-orange-primary/20 transition-all placeholder:text-gray-700"
                />
            </div>

            {/* Tabela de Preços */}
            <div className="glass-card rounded-[2.5rem] bg-white/[0.02] border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <div className="inline-block min-w-full align-middle">
                        <table className="min-w-full divide-y divide-white/5">
                            <thead>
                                <tr className="bg-white/[0.03]">
                                    <th scope="col" className="px-6 py-4 text-left text-[9px] font-black text-gray-500 uppercase tracking-widest">Bairro</th>
                                    {columns.map(col => (
                                        <th key={col} scope="col" className="px-6 py-4 text-center text-[9px] font-black text-gray-300 uppercase tracking-widest bg-orange-primary/5">
                                            {col.replace('pre_', 'TAB ')}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? (
                                    <tr>
                                        <td colSpan={columns.length + 1} className="py-20 text-center">
                                            <Loader2 className="animate-spin text-orange-primary mx-auto" size={32} />
                                        </td>
                                    </tr>
                                ) : filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan={columns.length + 1} className="py-12 text-center text-[10px] font-black text-gray-700 uppercase">Nenhum bairro encontrado</td>
                                    </tr>
                                ) : (
                                    filteredData.map((row) => (
                                        <tr key={row.id} className="hover:bg-white/[0.01] transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-[11px] font-bold text-gray-400">{row.bairro}</td>
                                            {columns.map(col => (
                                                <td key={col} className="px-4 py-2 text-center">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={row[col]}
                                                        onChange={(e) => handleUpdateValue(row.id, col, e.target.value)}
                                                        className="w-20 bg-zinc-900/50 border border-white/5 rounded-lg h-10 px-2 text-center text-xs font-black text-white focus:border-orange-primary/40 outline-none transition-all"
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Botão Flutuante Salvar */}
            {!loading && data.length > 0 && (
                <div className="fixed bottom-32 left-1/2 -translate-x-1/2 w-full max-w-[340px] px-6">
                    <button
                        onClick={saveChanges}
                        disabled={saving}
                        className="w-full h-14 bg-lime-500 hover:bg-lime-600 disabled:opacity-50 text-black rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl shadow-lime-500/20 transition-all"
                    >
                        {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        {saving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            )}

            {/* Modal Adicionar Bairro */}
            {showAddBairro && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade">
                    <div className="w-full max-w-sm bg-zinc-950 rounded-[3rem] border border-white/5 p-8 shadow-2xl">
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-1">Novo Bairro</h2>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-6">Cadastrar área de cobertura</p>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">Nome do Bairro</p>
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

            {/* Info Alert */}
            <div className="bg-sky-500/5 border border-sky-500/10 p-4 rounded-3xl flex items-start gap-4">
                <AlertCircle className="text-sky-500 shrink-0" size={18} />
                <div>
                    <p className="text-[10px] font-bold text-sky-500 uppercase tracking-widest mb-1">Dica de Gestão</p>
                    <p className="text-[10px] text-gray-500 leading-relaxed font-medium">As colunas representam suas tabelas de preço. Ao cadastrar uma loja, você escolhe qual dessas tabelas ela utilizará para calcular os fretes automaticamente.</p>
                </div>
            </div>
        </div>
    );
};

export default PriceTables;
