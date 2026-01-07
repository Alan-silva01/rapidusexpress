
import React, { useState } from 'react';
import { X, Save, MapPin, Phone, Building2, CreditCard, FileText, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';

interface NewClientFormProps {
    onClose: () => void;
    onSuccess: () => void;
}

const NewClientForm: React.FC<NewClientFormProps> = ({ onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        nome: '',
        preco: 'pre_001',
        descricao: '',
        telefone: '',
        cep: '65930-000',
        rua: '',
        numero: '',
        bairro: 'Centro',
        cidade: 'Açailândia',
        estado: 'MA',
        latitude: '',
        longitude: '',
        google_maps_url: ''
    });

    const formatWhatsApp = (phone: string) => {
        // Remove tudo que não é número
        let clean = phone.replace(/\D/g, '');

        // Caso 1: Usuário digitou DDD + 9 dígitos (ex: 99912345678)
        if (clean.length === 11 && !clean.startsWith('55')) {
            // Remove o '9' extra após o DDD (index 2)
            clean = clean.slice(0, 2) + clean.slice(3);
        }

        // Caso 2: Se agora tem 10 dígitos (DDD + 8 dígitos), adicionamos o 55
        if (clean.length === 10) {
            clean = '55' + clean;
        }

        // Caso 3: Se já veio com 55 + DDD + 9 dígitos (ex: 5599912345678) = 13 dígitos
        if (clean.length === 13 && clean.startsWith('55')) {
            // Remove o '9' extra no index 4 (5, 5, D, D, [9], ...)
            clean = clean.slice(0, 4) + clean.slice(5);
        }

        return `${clean}@s.whatsapp.net`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const whatsappFormatted = formatWhatsApp(formData.telefone);

            // Construir o objeto JSON conforme o padrão legado
            const dadosObjeto = {
                nome: formData.nome,
                preco: formData.preco,
                endereco: {
                    cep: formData.cep,
                    rua: formData.rua,
                    pais: "Brasil",
                    bairro: formData.bairro,
                    cidade: formData.cidade,
                    estado: formData.estado,
                    numero: formData.numero
                },
                telefone: whatsappFormatted,
                descricao: formData.descricao,
                localizacao: {
                    latitude: parseFloat(formData.latitude) || 0,
                    longitude: parseFloat(formData.longitude) || 0,
                    google_maps_url: formData.google_maps_url
                }
            };

            // Inserimos APENAS na tabela 'clientes'. 
            // O trigger no banco de dados cuidará de criar o registro em 'estabelecimentos'.
            const { error } = await supabase.from('clientes').insert([
                {
                    numero: whatsappFormatted,
                    dados: JSON.stringify(dadosObjeto),
                    entregas: "[]"
                }
            ]);

            if (error) {
                throw new Error(`Erro ao salvar no banco: ${error.message}`);
            }

            onSuccess();
        } catch (err: any) {
            console.error('Erro ao cadastrar cliente:', err);
            alert(err.message || 'Erro ao cadastrar cliente. Verifique o console.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/90 backdrop-blur-md animate-fade" onClick={onClose}>
            <div className="w-full max-w-xl bg-zinc-950 rounded-t-[3rem] border-t border-white/5 p-8 pb-12 overflow-y-auto max-h-[92vh]" onClick={e => e.stopPropagation()}>
                <div className="w-12 h-1.5 bg-zinc-900 rounded-full mx-auto mb-8"></div>

                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tighter uppercase">Novo Estabelecimento</h2>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">Cadastro de Parceiro</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Dados Básicos */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-orange-primary uppercase tracking-[0.2em] px-1">Informações Gerais</h3>

                        <div className="grid grid-cols-1 gap-4">
                            <InputGroup label="Nome Fantasia" icon={<Building2 size={16} />}>
                                <input
                                    required
                                    value={formData.nome}
                                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                    className="input-base"
                                    placeholder="Ex: Drogasil"
                                />
                            </InputGroup>

                            <div className="grid grid-cols-2 gap-4">
                                <InputGroup label="Telefone / WhatsApp" icon={<Phone size={16} />}>
                                    <input
                                        required
                                        value={formData.telefone}
                                        onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                                        className="input-base"
                                        placeholder="99 91234-5678"
                                    />
                                </InputGroup>
                                <InputGroup label="Tabela Preço" icon={<CreditCard size={16} />}>
                                    <select
                                        value={formData.preco}
                                        onChange={e => setFormData({ ...formData, preco: e.target.value })}
                                        className="input-base cursor-pointer"
                                    >
                                        <option value="pre_001">TABELA 01</option>
                                        <option value="pre_002">TABELA 02</option>
                                        <option value="pre_003">TABELA 03</option>
                                    </select>
                                </InputGroup>
                            </div>

                            <InputGroup label="Ramo / Descrição" icon={<FileText size={16} />}>
                                <input
                                    value={formData.descricao}
                                    onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                                    className="input-base"
                                    placeholder="Ex: Farmácia, Restaurante..."
                                />
                            </InputGroup>
                        </div>
                    </div>

                    {/* Endereço */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <h3 className="text-[10px] font-black text-lime-500 uppercase tracking-[0.2em] px-1">Localização e Endereço</h3>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <InputGroup label="CEP" icon={<MapPin size={16} />}>
                                    <input
                                        value={formData.cep}
                                        onChange={e => setFormData({ ...formData, cep: e.target.value })}
                                        className="input-base"
                                    />
                                </InputGroup>
                                <InputGroup label="Bairro" icon={<MapPin size={16} />}>
                                    <input
                                        value={formData.bairro}
                                        onChange={e => setFormData({ ...formData, bairro: e.target.value })}
                                        className="input-base"
                                    />
                                </InputGroup>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <InputGroup label="Logradouro (Rua)" icon={<MapPin size={16} />}>
                                        <input
                                            required
                                            value={formData.rua}
                                            onChange={e => setFormData({ ...formData, rua: e.target.value })}
                                            className="input-base"
                                            placeholder="Nome da Rua"
                                        />
                                    </InputGroup>
                                </div>
                                <InputGroup label="Número" icon={<MapPin size={16} />}>
                                    <input
                                        required
                                        value={formData.numero}
                                        onChange={e => setFormData({ ...formData, numero: e.target.value })}
                                        className="input-base"
                                        placeholder="123"
                                    />
                                </InputGroup>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <InputGroup label="Latitude" icon={<MapPin size={16} />}>
                                    <input
                                        value={formData.latitude}
                                        onChange={e => setFormData({ ...formData, latitude: e.target.value })}
                                        className="input-base"
                                        placeholder="-4.9479"
                                    />
                                </InputGroup>
                                <InputGroup label="Longitude" icon={<MapPin size={16} />}>
                                    <input
                                        value={formData.longitude}
                                        onChange={e => setFormData({ ...formData, longitude: e.target.value })}
                                        className="input-base"
                                        placeholder="-47.5010"
                                    />
                                </InputGroup>
                            </div>

                            <InputGroup label="URL Google Maps" icon={<MapPin size={16} />}>
                                <input
                                    value={formData.google_maps_url}
                                    onChange={e => setFormData({ ...formData, google_maps_url: e.target.value })}
                                    className="input-base text-[10px]"
                                    placeholder="https://goo.gl/maps/..."
                                />
                            </InputGroup>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-14 bg-orange-primary hover:bg-orange-600 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-orange-primary/20 transition-all mt-8"
                    >
                        {loading ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div> : <Save size={20} />}
                        {loading ? 'Salvando...' : 'Finalizar Cadastro'}
                    </button>
                </form>
            </div>

            <style>{`
                .input-base {
                    width: 100%;
                    height: 3rem;
                    background: #0F0F0F;
                    border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 1rem;
                    padding: 0 1rem;
                    color: white;
                    font-size: 0.75rem;
                    font-weight: 600;
                    outline: none;
                    transition: all 0.2s;
                }
                .input-base:focus {
                    border-color: rgba(255,92,0,0.3);
                    background: #141414;
                }
            `}</style>
        </div>
    );
};

const InputGroup = ({ label, icon, children }: any) => (
    <div className="space-y-1.5 flex-1">
        <div className="flex items-center gap-2 px-1">
            <span className="text-gray-600">{icon}</span>
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{label}</span>
        </div>
        {children}
    </div>
);

export default NewClientForm;
