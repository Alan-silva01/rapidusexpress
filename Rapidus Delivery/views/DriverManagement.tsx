
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Users, Plus, X, Bike, Search, Loader2, Check, Phone, Mail, User, CreditCard, ChevronLeft, Lock, Camera } from 'lucide-react';
import { cropToSquare } from '../utils/imageUtils';

const DriverManagement: React.FC = () => {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    telefone: '',
    chave_pix: '',
    moto_modelo: '',
    moto_cilindrada: '',
    porcentagem_lucro_admin: 20,
    valor_fixo_admin: 0,
    foto_url: ''
  });

  const [uploading, setUploading] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const croppedBlob = await cropToSquare(file, 400);
      const fileName = `temp-${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from('fotos')
        .upload(`perfis/${fileName}`, croppedBlob, {
          contentType: 'image/jpeg'
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('fotos')
        .getPublicUrl(`perfis/${fileName}`);

      setFormData({ ...formData, foto_url: publicUrl });
    } catch (err) {
      console.error(err);
      alert('Erro ao processar foto');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('perfis').select('*').eq('funcao', 'entregador');
      setDrivers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Verificar limite extra no salvamento
      const { count, error: countError } = await supabase
        .from('perfis')
        .select('id', { count: 'exact', head: true })
        .eq('funcao', 'entregador');

      if (countError) throw countError;
      if ((count || 0) >= 5) {
        throw new Error('Limite de 5 entregadores atingido.');
      }

      // Usando RPC ou Edge Function para criar Auth + Perfil sem deslogar o Admin
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: formData.email,
          password: formData.senha,
          profile_data: {
            nome: formData.nome,
            telefone: formData.telefone,
            chave_pix: formData.chave_pix,
            moto_modelo: formData.moto_modelo,
            moto_cilindrada: formData.moto_cilindrada,
            porcentagem_lucro_admin: formData.porcentagem_lucro_admin,
            valor_fixo_admin: formData.valor_fixo_admin,
            foto_url: formData.foto_url,
            funcao: 'entregador',
            disponivel: false
          }
        }
      });

      if (error) throw error;

      setIsCreating(false);
      setFormData({ nome: '', email: '', senha: '', telefone: '', chave_pix: '', moto_modelo: '', moto_cilindrada: '', porcentagem_lucro_admin: 20, valor_fixo_admin: 0, foto_url: '' });
      await fetchDrivers();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar entregador');
    } finally {
      setSaving(false);
    }
  };

  if (isCreating) {
    return (
      <div className="animate-fade space-y-8 pb-10">
        <header className="flex items-center gap-4">
          <button onClick={() => setIsCreating(false)} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tighter">Novo Entregador</h1>
            <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Cadastro de parceiro</p>
          </div>
        </header>

        <form onSubmit={handleAddDriver} className="space-y-6">
          <div className="glass-card p-6 rounded-[2.5rem] space-y-5 border-white/5">
            {/* Photo Upload for Driver */}
            <div className="flex flex-col items-center pb-4">
              <div className="relative group">
                <div className="w-24 h-24 rounded-[2rem] bg-white/5 border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden">
                  {formData.foto_url ? (
                    <img src={formData.foto_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <User size={32} className="text-gray-700" />
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 size={24} className="animate-spin text-orange-primary" />
                    </div>
                  )}
                </div>
                <label className="absolute -bottom-1 -right-1 w-8 h-8 bg-orange-primary rounded-lg flex items-center justify-center text-white cursor-pointer shadow-lg hover:scale-110 transition-all">
                  <Camera size={14} />
                  <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
                </label>
              </div>
              <p className="text-[9px] font-black text-gray-700 uppercase tracking-widest mt-3">Foto do Perfil</p>
            </div>

            <InputGroup label="Nome do Motoboy" icon={<User size={18} />} value={formData.nome} onChange={(v: string) => setFormData({ ...formData, nome: v })} placeholder="Ex: João Silva" />
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="E-mail de Acesso" icon={<Mail size={18} />} value={formData.email} onChange={(v: string) => setFormData({ ...formData, email: v })} type="email" placeholder="joao@email.com" />
              <InputGroup label="Senha de Acesso" icon={<Lock size={18} />} value={formData.senha} onChange={(v: string) => setFormData({ ...formData, senha: v })} type="password" placeholder="******" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="WhatsApp" icon={<Phone size={18} />} value={formData.telefone} onChange={(v: string) => setFormData({ ...formData, telefone: v })} placeholder="(99) 9..." />
              <InputGroup label="Chave PIX" icon={<CreditCard size={18} />} value={formData.chave_pix} onChange={(v: string) => setFormData({ ...formData, chave_pix: v })} placeholder="E-mail ou CPF" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Modelo da Moto" icon={<Bike size={18} />} value={formData.moto_modelo} onChange={(v: string) => setFormData({ ...formData, moto_modelo: v })} placeholder="Honda CG 160" />
              <InputGroup label="Cilindrada" icon={<Bike size={18} />} value={formData.moto_cilindrada} onChange={(v: string) => setFormData({ ...formData, moto_cilindrada: v })} placeholder="160cc" />
            </div>

            <div className="h-px bg-white/5 my-2" />

            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Comissão (%)" icon={<Check size={18} />} value={formData.porcentagem_lucro_admin} onChange={(v: string) => setFormData({ ...formData, porcentagem_lucro_admin: Number(v) })} type="number" />
              <InputGroup label="Taxa Fixa (R$)" icon={<Check size={18} />} value={formData.valor_fixo_admin} onChange={(v: string) => setFormData({ ...formData, valor_fixo_admin: Number(v) })} type="number" />
            </div>
          </div>

          <button
            disabled={saving}
            className="w-full h-16 bg-orange-primary text-white rounded-3xl font-black flex items-center justify-center gap-2 shadow-xl shadow-orange-primary/20 transition-all active:scale-95 disabled:opacity-50 text-[11px] uppercase tracking-widest"
          >
            {saving ? <Loader2 className="animate-spin" size={20} /> : 'Finalizar Cadastro'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tighter">Equipe Rapidus</h1>
          <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Gestão de entregadores ({drivers.length}/5)</p>
        </div>
        <button
          onClick={() => drivers.length < 5 ? setIsCreating(true) : alert('Limite de 5 entregadores atingido.')}
          disabled={drivers.length >= 5}
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg transition-all ${drivers.length >= 5 ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-orange-primary shadow-orange-primary/20 hover:scale-105 active:scale-95'}`}
        >
          <Plus size={20} />
        </button>
      </header>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700" size={14} />
        <input
          type="text"
          placeholder="Filtrar motoboys..."
          className="w-full h-12 bg-white/5 rounded-2xl pl-11 pr-4 text-[10px] font-bold border border-white/5 outline-none focus:border-orange-primary/20"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-orange-primary" size={32} /></div>
      ) : (
        <div className="space-y-3">
          {drivers.map(driver => (
            <div key={driver.id} className="glass-card p-4 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img src={driver.foto_url || `https://picsum.photos/seed/${driver.id}/100/100`} className="w-11 h-11 rounded-xl object-cover" alt="" />
                <div>
                  <h4 className="text-xs font-black tracking-tight">{driver.nome}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${driver.disponivel ? 'bg-lime-500' : 'bg-gray-700'}`}></span>
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{driver.moto_modelo || 'A pé'}</p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-white">{driver.porcentagem_lucro_admin}% comissão</p>
                <p className="text-[8px] font-bold text-gray-700 uppercase tracking-widest">Taxa Admin</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const InputGroup = ({ label, icon, value, onChange, placeholder, type = 'text' }: any) => (
  <div className="space-y-1.5">
    <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest ml-1">{label}</label>
    <div className="relative group">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700 group-focus-within:text-orange-primary transition-colors">
        {icon}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 text-[11px] font-bold text-white outline-none focus:border-orange-primary/20 transition-all placeholder:text-gray-800"
        placeholder={placeholder}
      />
    </div>
  </div>
);

export default DriverManagement;
