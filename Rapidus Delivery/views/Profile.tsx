
import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Perfil } from '../types';
import { Camera, MapPin, Phone, CreditCard, Bike, Check, Loader2, User, LogOut, Bell } from 'lucide-react';
import { cropToSquare } from '../utils/imageUtils';

interface ProfileProps {
  profile: Perfil;
  onUpdate: (id: string) => void;
  onLogout: () => void;
}

const Profile: React.FC<ProfileProps> = ({ profile, onUpdate, onLogout }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: profile.nome,
    telefone: profile.telefone || '',
    chave_pix: profile.chave_pix || '',
    endereco: profile.endereco || '',
    moto_modelo: profile.moto_modelo || '',
    moto_cilindrada: profile.moto_cilindrada || '',
  });

  const [uploading, setUploading] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // 1. Crop to square
      const croppedBlob = await cropToSquare(file, 400);

      // 2. Upload to storage
      const fileName = `${profile.id}-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('fotos') // Usando o bucket 'fotos' que já sabemos que existe
        .upload(`perfis/${fileName}`, croppedBlob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('fotos')
        .getPublicUrl(`perfis/${fileName}`);

      // 4. Update Profile
      const { error: updateError } = await supabase
        .from('perfis')
        .update({ foto_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      onUpdate(profile.id);
    } catch (err) {
      console.error('Erro no upload:', err);
      alert('Erro ao atualizar foto');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('perfis').update(formData).eq('id', profile.id);
      if (error) throw error;
      onUpdate(profile.id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade pb-24">
      <header className="relative flex flex-col items-center text-center">
        <button
          onClick={onLogout}
          className="absolute top-0 right-0 p-3 bg-white/5 border border-white/5 rounded-2xl text-gray-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
          title="Sair"
        >
          <LogOut size={20} />
        </button>
        <div className="relative group">
          <img
            src={profile.foto_url || `https://picsum.photos/seed/${profile.id}/200/200`}
            className={`w-28 h-28 rounded-[2.5rem] object-cover border-4 border-white/5 shadow-2xl transition-transform group-hover:scale-105 ${uploading ? 'opacity-50' : ''}`}
            alt={profile.nome}
          />
          <label className="absolute -bottom-1 -right-1 w-9 h-9 bg-orange-primary rounded-xl flex items-center justify-center text-white border-4 border-black shadow-lg cursor-pointer hover:scale-110 active:scale-95 transition-all">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
          </label>
        </div>
        <h2 className="text-xl font-black mt-6 tracking-tight uppercase">{profile.nome}</h2>
        <p className="text-[10px] text-orange-primary font-black uppercase tracking-[0.3em] mt-1">{profile.funcao}</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-card p-6 rounded-[2.5rem] space-y-5 border-white/5">
          <InputGroup label="Nome Completo" icon={<User size={16} />} value={formData.nome} onChange={(v: string) => setFormData({ ...formData, nome: v })} />
          <InputGroup label="WhatsApp" icon={<Phone size={16} />} value={formData.telefone} onChange={(v: string) => setFormData({ ...formData, telefone: v })} />
          <InputGroup label="Chave PIX" icon={<CreditCard size={16} />} value={formData.chave_pix} onChange={(v: string) => setFormData({ ...formData, chave_pix: v })} />

          {profile.funcao === 'entregador' && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <InputGroup label="Modelo Moto" icon={<Bike size={16} />} value={formData.moto_modelo} onChange={(v: string) => setFormData({ ...formData, moto_modelo: v })} />
              <InputGroup label="Cilindrada" icon={<Bike size={16} />} value={formData.moto_cilindrada} onChange={(v: string) => setFormData({ ...formData, moto_cilindrada: v })} />
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-16 bg-orange-primary text-white rounded-3xl font-black flex items-center justify-center gap-2 shadow-xl shadow-orange-primary/20 transition-all active:scale-95 disabled:opacity-50 text-[11px] uppercase tracking-widest"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <><Check size={18} /> Salvar Configurações</>}
        </button>

        <button
          type="button"
          onClick={async () => {
            const email = profile.email || (await supabase.auth.getUser()).data.user?.email;
            if (email) {
              const { error } = await supabase.auth.resetPasswordForEmail(email);
              if (error) alert('Erro ao enviar e-mail: ' + error.message);
              else alert('E-mail de redefinição enviado!');
            }
          }}
          className="w-full h-14 bg-white/5 text-gray-400 rounded-3xl font-black flex items-center justify-center gap-2 border border-white/5 transition-all active:scale-95 text-[9px] uppercase tracking-widest"
        >
          Redefinir Senha
        </button>

        <button
          type="button"
          onClick={async () => {
            try {
              // Use OneSignal for notifications
              if (typeof window !== 'undefined' && (window as any).OneSignalDeferred) {
                (window as any).OneSignalDeferred.push(async function (OneSignal: any) {
                  try {
                    // Request permission via OneSignal
                    await OneSignal.Notifications.requestPermission();

                    // Register user with their Supabase ID
                    await OneSignal.login(profile.id);

                    console.log('✅ OneSignal: User registered with ID:', profile.id);
                    alert('Notificações ativadas com sucesso!');
                  } catch (e: any) {
                    console.error('OneSignal error:', e);
                    alert('Erro ao ativar notificações: ' + e.message);
                  }
                });
              } else {
                alert('Sistema de notificações não está pronto. Recarregue a página.');
              }
            } catch (err: any) {
              console.error(err);
              alert('Erro ao ativar notificações: ' + err.message);
            }
          }}
          className="w-full h-14 bg-orange-primary/10 text-orange-primary rounded-3xl font-black flex items-center justify-center gap-2 border border-orange-primary/20 transition-all active:scale-95 text-[9px] uppercase tracking-widest"
        >
          <Bell size={16} /> Ativar Notificações
        </button>
      </form>
    </div>
  );
};

const InputGroup = ({ label, icon, value, onChange }: any) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-gray-700 uppercase tracking-[0.2em] ml-1">{label}</label>
    <div className="relative group">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700 group-focus-within:text-orange-primary transition-colors">
        {icon}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 text-[11px] font-bold text-white outline-none focus:border-orange-primary/20 transition-all"
        placeholder="..."
      />
    </div>
  </div>
);

export default Profile;
