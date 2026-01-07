
export type UserRole = 'admin' | 'entregador';

export interface Perfil {
  id: string;
  funcao: UserRole;
  email: string;
  nome: string;
  telefone?: string;
  chave_pix?: string;
  endereco?: string;
  foto_url?: string;
  latitude?: number;
  longitude?: number;
  moto_modelo?: string;
  moto_cilindrada?: string;
  disponivel: boolean;
  saldo?: number;
  porcentagem_lucro_admin?: number;
  valor_fixo_admin?: number;
  criado_at: string;
}

export interface Estabelecimento {
  id: string;
  nome: string;
  numero_whatsapp: string;
  telefone?: string;
  endereco?: string;
  bairro?: string;
  preco_padrao?: string;
  latitude?: number;
  longitude?: number;
}

export interface Entrega {
  id: string;
  estabelecimento_id: string;
  entregador_id?: string;
  valor_total: number;
  valor_entregador: number;
  lucro_admin: number;
  pago_pelo_estabelecimento: boolean;
  pago_ao_entregador: boolean;
  data_entrega: string;
  status: 'pendente' | 'atribuida' | 'aceita' | 'coletada' | 'em_rota' | 'finalizada';
  observacao?: string;
  nome_cliente?: string;
  telefone_cliente?: string;
  endereco_cliente?: string[];
  criado_at: string;
}

export interface ResumoAdmin {
  total_entregas: number;
  faturado_bruto: number;
  custo_entregadores: number;
  lucro_liquido: number;
}
