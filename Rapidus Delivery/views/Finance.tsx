
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, X, Loader2, ChevronRight } from 'lucide-react';

const Finance: React.FC = () => {
  const [resumoStores, setResumoStores] = useState<any[]>([]);
  const [resumoDrivers, setResumoDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [tipo, setTipo] = useState<'recebimento_estabelecimento' | 'pagamento_entregador'>('recebimento_estabelecimento');
  const [entidadeId, setEntidadeId] = useState('');
  const [valor, setValor] = useState('');
  const [metodo, setMetodo] = useState('PIX');

  useEffect(() => {
    fetchFinanceData();
  }, []);

  const fetchFinanceData = async () => {
    try {
      const { data: stores } = await supabase.from('v_resumo_estabelecimentos').select('*');
      const { data: drivers } = await supabase.from('v_resumo_entregadores').select('*');
      setResumoStores(stores || []);
      setResumoDrivers(drivers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entidadeId || !valor) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('transacoes_financeiras').insert({
        tipo,
        entidade_id: entidadeId,
        valor: parseFloat(valor),
        metodo_pagamento: metodo,
        data_transacao: new Date().toISOString()
      });
      if (error) throw error;
      setShowModal(false);
      setValor('');
      await fetchFinanceData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-fade">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tighter">Caixa Geral</h1>
          <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Fluxo de pagamentos</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="w-10 h-10 bg-orange-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-primary/20"
        >
          <Plus size={20} />
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-orange-primary" size={32} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <SummaryCard label="A Receber" value={resumoStores.reduce((acc, curr) => acc + (curr.saldo_faltante || 0), 0)} color="text-lime-500" />
            <SummaryCard label="A Pagar" value={resumoDrivers.reduce((acc, curr) => acc + (curr.saldo_a_pagar || 0), 0)} color="text-orange-primary" />
          </div>

          <section className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 px-1">Lojas em Aberto</h3>
              <div className="space-y-2">
                {resumoStores.map(store => (
                  <FinanceRow key={store.id} title={store.nome} subtitle={`${store.total_entregas || 0} entregas`} value={store.saldo_faltante || 0} orange={(store.saldo_faltante || 0) > 0} />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 px-1">Pendências Motoboys</h3>
              <div className="space-y-2">
                {resumoDrivers.map(driver => (
                  <FinanceRow key={driver.id} title={driver.nome} subtitle="Saldo acumulado" value={driver.saldo_a_pagar || 0} orange={(driver.saldo_a_pagar || 0) > 0} />
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm animate-fade">
          <div className="glass-card w-full max-w-sm p-8 rounded-[2.5rem] border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black uppercase tracking-tighter">Lançamento</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleAddTransaction} className="space-y-5">
              <div className="flex p-1 bg-white/5 rounded-2xl">
                <button type="button" onClick={() => setTipo('recebimento_estabelecimento')} className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${tipo === 'recebimento_estabelecimento' ? 'bg-orange-primary text-white' : 'text-gray-600'}`}>Loja</button>
                <button type="button" onClick={() => setTipo('pagamento_entregador')} className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${tipo === 'pagamento_entregador' ? 'bg-orange-primary text-white' : 'text-gray-600'}`}>Motoboy</button>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-gray-700 tracking-[0.2em] mb-1.5 block ml-1">Entidade</label>
                <select value={entidadeId} onChange={(e) => setEntidadeId(e.target.value)} className="w-full h-12 bg-white/5 border border-white/5 rounded-xl px-4 text-[11px] font-bold text-white outline-none focus:border-orange-primary/20 appearance-none">
                  <option value="">Selecione...</option>
                  {tipo === 'recebimento_estabelecimento' ? resumoStores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>) : resumoDrivers.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-700 tracking-[0.2em] mb-1.5 block ml-1">Valor</label>
                  <input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className="w-full h-12 bg-white/5 border border-white/5 rounded-xl px-4 text-xs font-bold text-white outline-none focus:border-orange-primary/20" placeholder="0,00" />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-gray-700 tracking-[0.2em] mb-1.5 block ml-1">Método</label>
                  <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className="w-full h-12 bg-white/5 border border-white/5 rounded-xl px-4 text-[11px] font-bold text-white outline-none focus:border-orange-primary/20 appearance-none">
                    <option value="PIX">PIX</option>
                    <option value="Dinheiro">Dinheiro</option>
                  </select>
                </div>
              </div>
              <button disabled={saving} className="w-full h-14 bg-orange-primary text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-lg shadow-orange-primary/20 transition-all active:scale-95 disabled:opacity-50">
                {saving ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Confirmar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({ label, value, color }: any) => (
  <div className="glass-card p-5 rounded-3xl">
    <p className="text-[9px] font-black text-gray-700 uppercase mb-1 tracking-widest">{label}</p>
    <p className={`text-lg font-black tracking-tighter ${color}`}>R$ {(value || 0).toFixed(2)}</p>
  </div>
);

const FinanceRow = ({ title, subtitle, value, orange }: any) => (
  <div className="glass-card p-4 rounded-2xl flex items-center justify-between group">
    <div>
      <h4 className="text-xs font-black tracking-tight">{title}</h4>
      <p className="text-[9px] font-black text-gray-700 uppercase tracking-widest mt-0.5">{subtitle}</p>
    </div>
    <div className="text-right">
      <p className={`text-sm font-black tracking-tighter ${orange ? 'text-orange-primary' : 'text-lime-500'}`}>R$ {(value || 0).toFixed(2)}</p>
      <ChevronRight size={12} className="text-gray-800 ml-auto mt-0.5" />
    </div>
  </div>
);

export default Finance;
