
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Plus, X, Loader2, ChevronRight, Calendar, Filter, ArrowUpCircle, ArrowDownCircle, Wallet, History, Search } from 'lucide-react';
import { Perfil } from '../types';

interface FinanceProps {
  profile?: Perfil | null;
}

const Finance: React.FC<FinanceProps> = ({ profile }) => {
  const [resumoStores, setResumoStores] = useState<any[]>([]);
  const [resumoDrivers, setResumoDrivers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState({
    comissoes: 0,
    proprio: 0,
    recebido: 0,
    pago: 0
  });

  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filtros
  const [tipo, setTipo] = useState<'recebimento_estabelecimento' | 'pagamento_entregador'>('recebimento_estabelecimento');
  const [entidadeId, setEntidadeId] = useState('');
  const [valor, setValor] = useState('');
  const [metodo, setMetodo] = useState('PIX');
  const [observacao, setObservacao] = useState('');

  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchFinanceData();
  }, [startDate, endDate]);

  const fetchFinanceData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: stores } = await supabase.from('v_resumo_estabelecimentos').select('*');
      const { data: drivers } = await supabase.from('v_resumo_entregadores').select('*');

      // 1. Ganhos do Admin (Comissões + Próprio)
      const { data: globalStats } = await supabase
        .from('entregas')
        .select('valor_total, valor_entregador, lucro_admin, entregador_id')
        .eq('status', 'finalizada')
        .gte('criado_at', `${startDate}T00:00:00Z`)
        .lte('criado_at', `${endDate}T23:59:59Z`);

      const comissoes = globalStats?.filter(d => d.entregador_id !== profile.id).reduce((acc, curr) => acc + (curr.lucro_admin || 0), 0) || 0;
      const proprio = globalStats?.filter(d => d.entregador_id === profile.id).reduce((acc, curr) => acc + (curr.valor_total || 0), 0) || 0;

      // 2. Fluxo de Caixa (Transações no período)
      const { data: txs } = await supabase
        .from('transacoes_financeiras')
        .select('*')
        .gte('data_transacao', `${startDate}T00:00:00Z`)
        .lte('data_transacao', `${endDate}T23:59:59Z`)
        .order('data_transacao', { ascending: false });

      const recebido = txs?.filter(t => t.tipo === 'recebimento_estabelecimento').reduce((acc, curr) => acc + (curr.valor || 0), 0) || 0;
      const pago = txs?.filter(t => t.tipo === 'pagamento_entregador').reduce((acc, curr) => acc + (curr.valor || 0), 0) || 0;

      setStats({ comissoes, proprio, recebido, pago });
      setResumoStores(stores || []);
      setResumoDrivers(drivers || []);
      setTransactions(txs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!entidadeId || !valor) {
      alert('Selecione uma entidade e informe o valor.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('transacoes_financeiras').insert({
        tipo,
        entidade_id: entidadeId,
        valor: parseFloat(valor),
        metodo_pagamento: metodo,
        observacao,
        data_transacao: new Date().toISOString()
      });
      if (error) throw error;
      setShowModal(false);
      setValor('');
      setObservacao('');
      await fetchFinanceData();
    } catch (err: any) {
      alert('Erro ao salvar transação: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openPaymentModal = (id: string, initialTipo: any, initialValor: number) => {
    setEntidadeId(id);
    setTipo(initialTipo);
    setValor(initialValor > 0 ? initialValor.toFixed(2) : '');
    setShowModal(true);
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
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 bg-white/5 rounded-2xl p-2 flex items-center gap-2 border border-white/5">
                <Calendar size={14} className="text-gray-600 ml-2" />
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-[10px] font-black text-gray-300 outline-none w-full" />
                <span className="text-gray-700 text-[10px] font-black uppercase">Até</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-[10px] font-black text-gray-300 outline-none w-full" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="glass-card p-6 rounded-[2.5rem] bg-gradient-to-br from-orange-primary/20 to-transparent border-orange-primary/10">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-orange-primary flex items-center justify-center text-white shadow-xl shadow-orange-primary/20">
                    <Wallet size={24} />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Seu Saldo Total</p>
                    <p className="text-3xl font-black text-white tracking-tighter">R$ {(stats.comissoes + stats.proprio).toFixed(2)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-5">
                  <div>
                    <p className="text-[8px] font-black text-gray-700 uppercase tracking-widest mb-1">Comissões</p>
                    <p className="text-sm font-black text-lime-500 tracking-tighter">R$ {stats.comissoes.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-gray-700 uppercase tracking-widest mb-1">Suas Entregas</p>
                    <p className="text-sm font-black text-orange-primary tracking-tighter">R$ {stats.proprio.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="glass-card p-5 rounded-3xl bg-lime-500/[0.03] border-lime-500/10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-lime-500/10 text-lime-500">
                      <ArrowUpCircle size={14} />
                    </div>
                    <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Recebido</p>
                  </div>
                  <p className="text-xl font-black text-white tracking-tighter">R$ {stats.recebido.toFixed(2)}</p>
                  <p className="text-[7px] text-gray-700 font-bold uppercase mt-1">Das lojas no período</p>
                </div>

                <div className="glass-card p-5 rounded-3xl bg-orange-primary/[0.03] border-orange-primary/10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-orange-primary/10 text-orange-primary">
                      <ArrowDownCircle size={14} />
                    </div>
                    <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Pago</p>
                  </div>
                  <p className="text-xl font-black text-white tracking-tighter">R$ {stats.pago.toFixed(2)}</p>
                  <p className="text-[7px] text-gray-700 font-bold uppercase mt-1">Aos motoboys no período</p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 px-1">Lojas em Aberto</h3>
              <div className="space-y-2">
                {resumoStores.map(store => (
                  <FinanceRow
                    key={store.id}
                    title={store.nome}
                    subtitle={`${store.total_entregas || 0} entregas totais`}
                    value={store.saldo_faltante || 0}
                    orange={(store.saldo_faltante || 0) > 0}
                    onClick={() => openPaymentModal(store.id, 'recebimento_estabelecimento', store.saldo_faltante)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 px-1">Pendências Motoboys</h3>
              <div className="space-y-2">
                {resumoDrivers.map(driver => (
                  <FinanceRow
                    key={driver.id}
                    title={driver.nome}
                    subtitle="Dívida acumulada"
                    value={driver.saldo_a_pagar || 0}
                    orange={(driver.saldo_a_pagar || 0) > 0}
                    onClick={() => openPaymentModal(driver.id, 'pagamento_entregador', driver.saldo_a_pagar)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 px-1">Histórico Recente</h3>
              <div className="space-y-2">
                {transactions.length === 0 ? (
                  <div className="glass-card p-10 text-center border-dashed border-white/5">
                    <History size={24} className="mx-auto mb-2 text-gray-800" />
                    <p className="text-[8px] text-gray-700 font-black uppercase tracking-widest">Nenhuma transação encontrada</p>
                  </div>
                ) : (
                  transactions.slice(0, 50).map(tx => (
                    <TransactionRow
                      key={tx.id}
                      tipo={tx.tipo}
                      valor={tx.valor}
                      data={tx.data_transacao}
                      metodo={tx.metodo_pagamento}
                      obs={tx.observacao}
                      entidade={
                        tx.tipo === 'recebimento_estabelecimento'
                          ? resumoStores.find(s => s.id === tx.entidade_id)?.nome || 'Loja'
                          : resumoDrivers.find(d => d.id === tx.entidade_id)?.nome || 'Motoboy'
                      }
                    />
                  ))
                )}
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
              <div>
                <label className="text-[9px] font-black uppercase text-gray-700 tracking-[0.2em] mb-1.5 block ml-1">Observação (Opcional)</label>
                <input type="text" value={observacao} onChange={(e) => setObservacao(e.target.value)} className="w-full h-12 bg-white/5 border border-white/5 rounded-xl px-4 text-xs font-bold text-white outline-none focus:border-orange-primary/20" placeholder="Ex: Pagamento parcial da semana" />
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
                    <option value="Cartão">Cartão</option>
                  </select>
                </div>
              </div>
              <button disabled={saving} className="w-full h-14 bg-orange-primary text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-lg shadow-orange-primary/20 transition-all active:scale-95 disabled:opacity-50">
                {saving ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Confirmar Lançamento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const FinanceRow = ({ title, subtitle, value, orange, onClick }: any) => (
  <div onClick={onClick} className="glass-card p-4 rounded-3xl flex items-center justify-between group active:scale-[0.98] transition-all cursor-pointer border border-white/[0.03] hover:border-white/10">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${orange ? 'bg-orange-primary/5 text-orange-primary' : 'bg-lime-500/5 text-lime-500'}`}>
        {orange ? <ArrowDownCircle size={18} /> : <ArrowUpCircle size={18} />}
      </div>
      <div>
        <h4 className="text-[13px] font-black tracking-tight text-white">{title}</h4>
        <p className="text-[9px] font-black text-gray-700 uppercase tracking-widest mt-0.5">{subtitle}</p>
      </div>
    </div>
    <div className="text-right">
      <p className={`text-[15px] font-black tracking-tighter ${orange ? 'text-orange-primary' : 'text-lime-500'}`}>R$ {(value || 0).toFixed(2)}</p>
      <div className="flex items-center justify-end gap-1 mt-0.5">
        <span className="text-[7px] font-black text-gray-800 uppercase tracking-widest">Resolver</span>
        <ChevronRight size={10} className="text-gray-800 group-hover:text-orange-primary" />
      </div>
    </div>
  </div>
);

const TransactionRow = ({ entidade, valor, tipo, data, metodo, obs }: any) => (
  <div className="glass-card p-4 rounded-3xl flex items-baseline justify-between border-white/[0.03] bg-white/[0.01]">
    <div className="flex items-start gap-3">
      <div className={`mt-1 w-2 h-2 rounded-full ${tipo === 'recebimento_estabelecimento' ? 'bg-lime-500 shadow-[0_0_8px_rgba(132,204,22,0.4)]' : 'bg-orange-primary shadow-[0_0_8px_rgba(255,77,0,0.4)]'}`} />
      <div>
        <h4 className="text-[12px] font-black tracking-tight text-gray-200">{entidade}</h4>
        <p className="text-[8px] font-black text-gray-700 uppercase tracking-widest leading-none mt-1">
          {new Date(data).toLocaleDateString('pt-BR')} • {metodo}
        </p>
        {obs && <p className="text-[9px] text-gray-500 italic mt-2 border-l border-white/5 pl-2">"{obs}"</p>}
      </div>
    </div>
    <div className="text-right">
      <p className={`text-[13px] font-black tracking-tighter ${tipo === 'recebimento_estabelecimento' ? 'text-lime-500' : 'text-orange-primary'}`}>
        {tipo === 'recebimento_estabelecimento' ? '+' : '-'} R$ {parseFloat(valor).toFixed(2)}
      </p>
    </div>
  </div>
);

export default Finance;
