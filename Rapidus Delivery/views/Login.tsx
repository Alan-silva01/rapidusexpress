
import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Mail, Lock, Loader2, ArrowRight, UserPlus, ShieldCheck, Bike, Check } from 'lucide-react';

const Login: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isRegistering) {
        const { data: authData, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (authData.user) {
          const { error: profileError } = await supabase.from('perfis').insert({
            id: authData.user.id,
            nome,
            email,
            funcao: 'admin',
            disponivel: false
          });
          if (profileError) throw profileError;
          alert('Conta criada! Agora entre com suas credenciais.');
          setIsRegistering(false);
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err: any) {
      setError(err.message || 'Erro na autenticação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-orange-primary/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />

      <div className="w-full max-w-sm z-10 animate-fade">
        <div className="text-center mb-12">
          <div className="inline-flex w-14 h-14 bg-orange-primary rounded-2xl items-center justify-center shadow-2xl shadow-orange-primary/40 mb-6 rotate-3">
            <span className="text-xl font-black text-white">R</span>
          </div>
          <h1 className="text-2xl font-black tracking-tighter mb-1 uppercase">Rapidus</h1>
          <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.3em]">Smart Delivery System</p>
        </div>

        <div className="glass-card p-8 rounded-[2.5rem] border-white/5 space-y-6">
          <div className="flex p-1 bg-white/5 rounded-2xl mb-2">
            <button onClick={() => setIsRegistering(false)} className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${!isRegistering ? 'bg-orange-primary text-white' : 'text-gray-600'}`}>Entrar</button>
            <button onClick={() => setIsRegistering(true)} className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${isRegistering ? 'bg-orange-primary text-white' : 'text-gray-600'}`}>Criar</button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {isRegistering && (
              <InputGroup label="Nome Completo" icon={<UserPlus size={18} />} value={nome} onChange={setNome} placeholder="Seu nome" autoComplete="off" />
            )}
            <InputGroup
              label="E-mail"
              icon={<Mail size={18} />}
              value={email}
              onChange={setEmail}
              placeholder="Digite seu e-mail"
              type="email"
              autoComplete="none"
            />
            <InputGroup
              label="Senha"
              icon={<Lock size={18} />}
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              type="password"
              autoComplete="new-password"
            />

            {error && (
              <div className="p-4 bg-orange-primary/5 border border-orange-primary/10 text-orange-primary rounded-2xl text-[10px] text-center font-black uppercase">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-orange-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-orange-primary/20 flex items-center justify-center gap-2 mt-4 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : (
                <>{isRegistering ? 'Finalizar Cadastro' : 'Acessar Painel'} <ArrowRight size={16} /></>
              )}
            </button>
          </form>


        </div>
      </div>
    </div>
  );
};

const InputGroup = ({ label, icon, value, onChange, placeholder, type = 'text', ...rest }: any) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest ml-1">{label}</label>
    <div className="relative group">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-orange-primary transition-colors">
        {icon}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 bg-white/5 border border-white/5 rounded-xl pl-12 pr-4 text-[11px] font-bold outline-none focus:border-orange-primary/20 transition-all text-white placeholder:text-gray-800"
        placeholder={placeholder}
        required
        autoComplete={rest.autoComplete || "off"}
        onFocus={(e) => e.target.removeAttribute('readonly')}
        readOnly
      />
    </div>
  </div>
);



export default Login;
