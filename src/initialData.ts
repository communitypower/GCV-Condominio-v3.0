/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Unit, Billing, MaintenanceRequest, Equipment, MaintenancePlan, OperationLog, PurchaseRequest, PaymentOrder } from './types';

export const INITIAL_UNITS: Unit[] = [
  { id: 'A-101', block: 'Bloco A', number: '101', ownerName: 'Carlos Eduardo Ramos', ownerEmail: 'carlos.ramos@email.com', ownerPhone: '(11) 98765-4321', type: 'apartment', status: 'occupied', fractionalShare: 0.008 },
  { id: 'A-102', block: 'Bloco A', number: '102', ownerName: 'Mariana Costa Albuquerque', ownerEmail: 'mariana.costa@email.com', ownerPhone: '(11) 97654-3210', type: 'apartment', status: 'occupied', fractionalShare: 0.008 },
  { id: 'A-201', block: 'Bloco A', number: '201', ownerName: 'Rodrigo Azevedo Neves', ownerEmail: 'rodrigo.neves@email.com', ownerPhone: '(11) 96543-2109', type: 'apartment', status: 'occupied', fractionalShare: 0.008 },
  { id: 'A-202', block: 'Bloco A', number: '202', ownerName: 'Simone Ribeiro Prado', ownerEmail: 'simone.prado@email.com', ownerPhone: '(11) 95432-1098', type: 'apartment', status: 'vacant', fractionalShare: 0.008 },
  { id: 'A-301', block: 'Bloco A', number: '301', ownerName: 'Thiago Mendes Ferreira', ownerEmail: 'thiago.ferreira@email.com', ownerPhone: '(11) 94321-0987', type: 'penthouse', status: 'occupied', fractionalShare: 0.016 },
  { id: 'A-302', block: 'Bloco A', number: '302', ownerName: 'Beatriz Santos Oliveira', ownerEmail: 'beatriz.oliveira@email.com', ownerPhone: '(11) 93210-9876', type: 'penthouse', status: 'maintenance', fractionalShare: 0.016 },
  
  { id: 'B-101', block: 'Bloco B', number: '101', ownerName: 'Marcelo Dias Vieira', ownerEmail: 'marcelo.vieira@email.com', ownerPhone: '(11) 92109-8765', type: 'apartment', status: 'occupied', fractionalShare: 0.008 },
  { id: 'B-102', block: 'Bloco B', number: '102', ownerName: 'Fernanda Lima de Souza', ownerEmail: 'fernanda.souza@email.com', ownerPhone: '(11) 91098-7654', type: 'apartment', status: 'occupied', fractionalShare: 0.008 },
  { id: 'B-201', block: 'Bloco B', number: '201', ownerName: 'Patrícia Gomes Peixoto', ownerEmail: 'patricia.gomes@email.com', ownerPhone: '(11) 90987-6543', type: 'apartment', status: 'occupied', fractionalShare: 0.008 },
  { id: 'B-202', block: 'Bloco B', number: '202', ownerName: 'Ricardo Tavares Cruz', ownerEmail: 'ricardo.cruz@email.com', ownerPhone: '(11) 89876-5432', type: 'apartment', status: 'vacant', fractionalShare: 0.008 },
  { id: 'B-301', block: 'Bloco B', number: '301', ownerName: 'Gabriel de Alencar', ownerEmail: 'gabriel.alencar@email.com', ownerPhone: '(11) 88765-4321', type: 'penthouse', status: 'occupied', fractionalShare: 0.016 },
  
  { id: 'C-01', block: 'Casas', number: 'Casa 01', ownerName: 'André de Souza Arantes', ownerEmail: 'andre.arantes@email.com', ownerPhone: '(11) 87654-3210', type: 'house', status: 'occupied', fractionalShare: 0.024 },
  { id: 'C-02', block: 'Casas', number: 'Casa 02', ownerName: 'Juliana Vasconcelos', ownerEmail: 'juliana.vasc@email.com', ownerPhone: '(11) 86543-2109', type: 'house', status: 'occupied', fractionalShare: 0.024 },
  { id: 'C-03', block: 'Casas', number: 'Casa 03', ownerName: 'Luiz Felipe Nogueira', ownerEmail: 'luiz.nogueira@email.com', ownerPhone: '(11) 85432-1098', type: 'house', status: 'occupied', fractionalShare: 0.024 }
];

export const INITIAL_BILLINGS: Billing[] = [
  // Abril/2026 (Maoria Pago/Overdue)
  {
    id: 'BIL-202604-A101',
    unitId: 'A-101',
    monthString: '2026-04',
    amount: 650.00,
    dueDate: '2026-04-10',
    status: 'paid',
    paidAt: '2026-04-09',
    issueDate: '2026-03-25',
    barcode: '34191.79001 01043.513184 91020.150008 7 97130000065000',
    pixQrCode: '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br/cob/BIL202604A1015204000053039865406650.005802BR5914GCVCONDOMINIO6009SAOPAULO62070503BIL202604A101',
    description: 'Taxa Condominial Ordinária - Abril 2026'
  },
  {
    id: 'BIL-202604-A102',
    unitId: 'A-102',
    monthString: '2026-04',
    amount: 650.00,
    dueDate: '2026-04-10',
    status: 'paid',
    paidAt: '2026-04-10',
    issueDate: '2026-03-25',
    barcode: '34191.79001 01043.513184 91020.150008 7 97130000065000',
    pixQrCode: '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br/cob/BIL202604A1025204000053039865406630.005802BR5914GCVCONDOMINIO6009SAOPAULO62070503BIL202604A102',
    description: 'Taxa Condominial Ordinária - Abril 2026'
  },
  {
    id: 'BIL-202604-A301',
    unitId: 'A-301',
    monthString: '2026-04',
    amount: 1450.00, // standard 1200 + 250 extra (fundo de reserva ou taxa extra)
    dueDate: '2026-04-10',
    status: 'paid',
    paidAt: '2026-04-08',
    issueDate: '2026-03-25',
    barcode: '34191.79001 01043.513184 91020.150008 7 97130000145000',
    pixQrCode: '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br/cob/BIL202604A30152040000530398654061450.005802BR5914GCVCONDOMINIO6009SAOPAULO62070503BIL202604A301',
    description: 'Taxa Condominial Ordinária + Fundo de Reserva - Abril 2026',
    extraCharges: [{ description: 'Fundo de Reserva', amount: 250.00 }]
  },
  {
    id: 'BIL-202604-C01',
    unitId: 'C-01',
    monthString: '2026-04',
    amount: 850.00,
    dueDate: '2026-04-10',
    status: 'overdue',
    issueDate: '2026-03-25',
    barcode: '34191.79001 01043.513184 91020.150008 7 97130000085000',
    pixQrCode: '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br/cob/BIL202604C015204000053039865406850.005802BR5914GCVCONDOMINIO6009SAOPAULO62070503BIL202604C01',
    description: 'Taxa Condominial Ordinária - Abril 2026',
    penaltyFee: 17.00, // 2% multa
    interestFee: 8.50  // juros
  },
  
  // Maio/2026 (Mês Atual - Vence hoje ou proximamente, alguns pendentes, alguns pagos)
  {
    id: 'BIL-202605-A101',
    unitId: 'A-101',
    monthString: '2026-05',
    amount: 650.00,
    dueDate: '2026-05-10',
    status: 'paid',
    paidAt: '2026-05-10',
    issueDate: '2026-04-25',
    barcode: '34191.79001 01043.513184 91020.150008 7 97130000065000',
    pixQrCode: '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br/cob/BIL202605A1015204000053039865406650.005802BR5914GCVCONDOMINIO6009SAOPAULO62070503BIL202605A101',
    description: 'Taxa Condominial Ordinária - Maio 2026'
  },
  {
    id: 'BIL-202605-A102',
    unitId: 'A-102',
    monthString: '2026-05',
    amount: 650.00,
    dueDate: '2026-05-10',
    status: 'pending',
    issueDate: '2026-04-25',
    barcode: '34191.79001 01043.513184 91020.150008 7 97130000065000',
    pixQrCode: '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br/cob/BIL202605A1025204000053039865406650.005802BR5914GCVCONDOMINIO6009SAOPAULO62070503BIL202605A102',
    description: 'Taxa Condominial Ordinária - Maio 2026'
  },
  {
    id: 'BIL-202605-A201',
    unitId: 'A-201',
    monthString: '2026-05',
    amount: 650.00,
    dueDate: '2026-05-10',
    status: 'paid',
    paidAt: '2026-05-08',
    issueDate: '2026-04-25',
    barcode: '34191.79001 01043.513184 91020.150008 7 97130000065000',
    pixQrCode: '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br/cob/BIL202605A2015204000053039865406650.005802BR5914GCVCONDOMINIO6009SAOPAULO62070503BIL202605A201',
    description: 'Taxa Condominial Ordinária - Maio 2026'
  },
  {
    id: 'BIL-202605-A301',
    unitId: 'A-301',
    monthString: '2026-05',
    amount: 1200.00,
    dueDate: '2026-05-10',
    status: 'pending',
    issueDate: '2026-04-25',
    barcode: '34191.79001 01043.513184 91020.150008 7 97130000120000',
    pixQrCode: '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br/cob/BIL202605A30152040000530398654061200.005802BR5914GCVCONDOMINIO6009SAOPAULO62070503BIL202605A301',
    description: 'Taxa Condominial Ordinária - Maio 2026'
  },
  {
    id: 'BIL-202605-A302',
    unitId: 'A-302',
    monthString: '2026-05',
    amount: 1200.00,
    dueDate: '2026-05-10',
    status: 'pending',
    issueDate: '2026-04-25',
    barcode: '34191.79001 01043.513184 91020.150008 7 97130000120000',
    pixQrCode: '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br/cob/BIL202605A30252040000530398654061200.005802BR5914GCVCONDOMINIO6009SAOPAULO62070503BIL202605A302',
    description: 'Taxa Condominial Ordinária - Maio 2026'
  },
  {
    id: 'BIL-202605-B101',
    unitId: 'B-101',
    monthString: '2026-05',
    amount: 650.00,
    dueDate: '2026-05-10',
    status: 'paid',
    paidAt: '2026-05-09',
    issueDate: '2026-04-25',
    barcode: '34191.79001 01043.513184 91020.150008 7 97130000065000',
    pixQrCode: '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br/cob/BIL202605B1015204000053039865406650.005802BR5914GCVCONDOMINIO6009SAOPAULO62070503BIL202605B101',
    description: 'Taxa Condominial Ordinária - Maio 2026'
  },
  {
    id: 'BIL-202605-B102',
    unitId: 'B-102',
    monthString: '2026-05',
    amount: 650.00,
    dueDate: '2026-05-10',
    status: 'pending',
    issueDate: '2026-04-25',
    barcode: '34191.79001 01043.513184 91020.150008 7 97130000065000',
    pixQrCode: '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br/cob/BIL202605B1025204000053039865406650.005802BR5914GCVCONDOMINIO6009SAOPAULO62070503BIL202605B102',
    description: 'Taxa Condominial Ordinária - Maio 2026'
  },
  {
    id: 'BIL-202605-B201',
    unitId: 'B-201',
    monthString: '2026-05',
    amount: 650.00,
    dueDate: '2026-05-10',
    status: 'paid',
    paidAt: '2026-05-10',
    issueDate: '2026-04-25',
    barcode: '34191.79001 01043.513184 91020.150008 7 97130000065000',
    pixQrCode: '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br/cob/BIL202605B2015204000053039865406650.005802BR5914GCVCONDOMINIO6009SAOPAULO62070503BIL202605B201',
    description: 'Taxa Condominial Ordinária - Maio 2026'
  },
  {
    id: 'BIL-202605-B301',
    unitId: 'B-301',
    monthString: '2026-05',
    amount: 1200.00,
    dueDate: '2026-05-10',
    status: 'paid',
    paidAt: '2026-05-09',
    issueDate: '2026-04-25',
    barcode: '34191.79001 01043.513184 91020.150008 7 97130000120000',
    pixQrCode: '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br/cob/BIL202605B30152040000530398654061200.005802BR5914GCVCONDOMINIO6009SAOPAULO62070503BIL202605B301',
    description: 'Taxa Condominial Ordinária - Maio 2026'
  },
  {
    id: 'BIL-202605-C01',
    unitId: 'C-01',
    monthString: '2026-05',
    amount: 850.00,
    dueDate: '2026-05-10',
    status: 'pending',
    issueDate: '2026-04-25',
    barcode: '34191.79001 01043.513184 91020.150008 7 97130000085000',
    pixQrCode: '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br/cob/BIL202605C015204000053039865406850.005802BR5914GCVCONDOMINIO6009SAOPAULO62070503BIL202605C01',
    description: 'Taxa Condominial Ordinária - Maio 2026'
  },
  {
    id: 'BIL-202605-C02',
    unitId: 'C-02',
    monthString: '2026-05',
    amount: 850.00,
    dueDate: '2026-05-10',
    status: 'paid',
    paidAt: '2026-05-10',
    issueDate: '2026-04-25',
    barcode: '34191.79001 01043.513184 91020.150008 7 97130000085000',
    pixQrCode: '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br/cob/BIL202605C025204000053039865406850.005802BR5914GCVCONDOMINIO6009SAOPAULO62070503BIL202605C02',
    description: 'Taxa Condominial Ordinária - Maio 2026'
  },
  {
    id: 'BIL-202605-C03',
    unitId: 'C-03',
    monthString: '2026-05',
    amount: 850.00,
    dueDate: '2026-05-10',
    status: 'pending',
    issueDate: '2026-04-25',
    barcode: '34191.79001 01043.513184 91020.150008 7 97130000085000',
    pixQrCode: '00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br/cob/BIL202605C035204000053039865406850.005802BR5914GCVCONDOMINIO6009SAOPAULO62070503BIL202605C03',
    description: 'Taxa Condominial Ordinária - Maio 2026'
  }
];

export const INITIAL_MAINTENANCE: MaintenanceRequest[] = [
  {
    id: 'MNT-001',
    unitId: 'COMMON',
    title: 'Limpeza da caixa d\'água',
    description: 'Higienização e desinfecção semestral obrigatória das caixas d\'água centrais e torres de distribuição do bloco A e B para garantia da qualidade de águas.',
    category: 'plumbing',
    priority: 'medium',
    status: 'reported',
    reportedAt: '2026-05-25T08:00:00Z',
    estimatedCost: 800.00,
    logs: [
      { id: 'log-1', author: 'Cassiano Marins (Administrador)', comment: 'Abertura de OS preventiva periódica de higienização de caixas reservatórias.', createdAt: '2026-05-25T08:00:00Z' }
    ]
  },
  {
    id: 'MNT-002',
    unitId: 'COMMON',
    title: '[Auto] Manutenção preventiva elevador d...',
    description: 'Verificação mecânica de cabos de tração, engraxamento das polias e ajuste de nivelamento micro-controlado dos elevadores do bloco B conforme plano mensal corporativo.',
    category: 'elevators',
    priority: 'medium',
    status: 'reported',
    reportedAt: '2026-05-25T10:00:00Z',
    estimatedCost: 1500.00,
    logs: [
      { id: 'log-1', author: 'Sistema Alerta GCV', comment: 'OS preventiva recorrente disparada pelo gatilho contratual mensal.', createdAt: '2026-05-25T10:00:00Z' }
    ]
  },
  {
    id: 'MNT-003',
    unitId: 'A-302',
    title: 'Infiltração na Suíte Principal',
    description: 'Vazamento proveniente do apartamento de cima ou do telhado está causando manchas no teto de gesso e queda de umidade intensa no painel.',
    category: 'plumbing',
    priority: 'high',
    status: 'in_progress',
    reportedAt: '2026-05-20T14:30:00Z',
    assignedStaff: 'Pedro Encanador & Cia',
    estimatedCost: 1200.00,
    logs: [
      { id: 'l1', author: 'Beatriz S. Oliveira (Condômina)', comment: 'Relatou manchas escuras no teto que estão aumentando de tamanho após a última chuva forte.', createdAt: '2026-05-20T14:30:00Z' },
      { id: 'l2', author: 'Cassiano (Síndico)', comment: 'Pedro encanador foi enviado para analisar. Ele confirmou que a origem é uma junta trincada na tubulação de escoamento pluvial.', createdAt: '2026-05-21T09:15:00Z' }
    ]
  },
  {
    id: 'MNT-004',
    unitId: 'COMMON',
    title: 'Troca da Bomba Principal da Piscina',
    description: 'A bomba do filtro leste parou de funcionar e está emitindo ruído de motor travado. Risco de água ficar turva antes do feriado.',
    category: 'common_area',
    priority: 'urgent',
    status: 'reported',
    reportedAt: '2026-05-25T10:00:00Z',
    assignedStaff: 'AcquaTec Serviços',
    estimatedCost: 2850.00,
    logs: [
      { id: 'l1', author: 'Zelador', comment: 'A bomba parou totalmente hoje de manhã. O motor está extremamente quente.', createdAt: '2026-05-25T10:05:00Z' }
    ]
  },
  {
    id: 'MNT-005',
    unitId: 'B-102',
    title: 'Disjuntor Geral Desarmando',
    description: 'O disjuntor principal da unidade desarma quando o chuveiro é ligado simultaneamente com o forno elétrico na cozinha de forma recorrente.',
    category: 'electrical',
    priority: 'medium',
    status: 'reported',
    reportedAt: '2026-05-24T18:20:00Z',
    logs: [
      { id: 'l1', author: 'Fernanda L. Souza (Condômina)', comment: 'A fiação parece antiga. Preciso que o eletricista avalie se o disjuntor de 40A é suficiente.', createdAt: '2026-05-24T18:20:00Z' }
    ]
  },
  {
    id: 'MNT-006',
    unitId: 'C-01',
    title: 'Vazamento na válvula de descarga',
    description: 'Descarga de vaso sanitário disparando fluxo livre de água, causando alto volume de desperdício e risco de conta de água elevada nas áreas comuns residenciais.',
    category: 'plumbing',
    priority: 'low',
    status: 'reported',
    reportedAt: '2026-05-23T11:00:00Z',
    logs: []
  },
  {
    id: 'MNT-007',
    unitId: 'COMMON',
    title: 'Restauração da pintura do portão',
    description: 'Portão de entrada social apresentando pátina de oxidação e raspões profundos causados por tráfego intenso. Pintura eletrostática recomendada.',
    category: 'structural',
    priority: 'low',
    status: 'reported',
    reportedAt: '2026-05-22T09:00:00Z',
    logs: []
  },
  {
    id: 'MNT-008',
    unitId: 'COMMON',
    title: 'Sensor de presença da garagem G1 queimado',
    description: 'Dois sensores de teto da rampa inicial do subsolo 1 pararam de acionar os refletores LED, deixando o trecho escuro e perigoso.',
    category: 'electrical',
    priority: 'low',
    status: 'in_progress',
    reportedAt: '2026-05-22T21:00:00Z',
    assignedStaff: 'Eletrotécnica J. Silva',
    logs: []
  },
  {
    id: 'MNT-009',
    unitId: 'COMMON',
    title: 'Ruído mecânico na porta automática da recepção',
    description: 'Porta giratória de vidro temperado emitindo estalo forte intermitente e atrito abrasivo quando atinge o fim de curso de fechamento hidráulico.',
    category: 'structural',
    priority: 'medium',
    status: 'reported',
    reportedAt: '2026-05-21T16:00:00Z',
    logs: []
  },
  {
    id: 'MNT-010',
    unitId: 'COMMON',
    title: 'Conserto do interfone analógico da Guarita',
    description: 'Interfone secundário destinado a contato rápido com portaria externa com ruído estático severo e chiado que impede a escuta límpida.',
    category: 'security',
    priority: 'high',
    status: 'reported',
    reportedAt: '2026-05-20T10:00:00Z',
    logs: []
  },
  {
    id: 'MNT-011',
    unitId: 'COMMON',
    title: 'Fixação de corrimão solto na escadaria B',
    description: 'Corrimão de aço tubular entre o 3º e o 4º andar da torre B balança quando pressionado devido a bucha plástica espanada.',
    category: 'structural',
    priority: 'high',
    status: 'reported',
    reportedAt: '2026-05-19T13:00:00Z',
    logs: []
  },
  {
    id: 'MNT-012',
    unitId: 'COMMON',
    title: 'Reposição de mudas secas floreira frontal',
    description: 'Substituição de 6 arbustos decorativos danificados por estresse hídrico na mureta de identificação frontal por espécies perenes de pouca rega.',
    category: 'gardens',
    priority: 'low',
    status: 'reported',
    reportedAt: '2026-05-18T15:00:00Z',
    logs: []
  },
  {
    id: 'MNT-013',
    unitId: 'COMMON',
    title: 'Diagnóstico do aquecedor solar central',
    description: 'Pressão nominal do circuito térmico se encontra abaixo do estipulado no manuel de engenharia técnica GCV.',
    category: 'electrical',
    priority: 'medium',
    status: 'reported',
    reportedAt: '2026-05-17T09:00:00Z',
    logs: []
  },
  {
    id: 'MNT-014',
    unitId: 'COMMON',
    title: 'Umidificação/Infiltração na garagem subsolo 1',
    description: 'Inspeção predial sobre brotamento de calcificação salina nas lajes estruturais de passagem sob o jardim sobressalente da guarita.',
    category: 'structural',
    priority: 'medium',
    status: 'reported',
    reportedAt: '2026-05-16T11:00:00Z',
    logs: []
  },
  {
    id: 'MNT-015',
    unitId: 'COMMON',
    title: 'Troca de lâmpadas de balizamento de emergência',
    description: '6 spots de luz autônomas na área comum de rotas de fuga apresentando baterias vencidas e sem potência operacional nominal.',
    category: 'electrical',
    priority: 'low',
    status: 'reported',
    reportedAt: '2026-05-15T14:30:00Z',
    logs: []
  },
  {
    id: 'MNT-016',
    unitId: 'COMMON',
    title: 'Verificação semestral da expiração de extintores',
    description: 'Varredura e catalogação sistemática de todos os 32 extintores de incêndio (pó químico seco, CO2, água pressurizada) das torres A e B.',
    category: 'other',
    priority: 'medium',
    status: 'in_progress',
    reportedAt: '2026-05-14T08:00:00Z',
    assignedStaff: 'Combate Fogo Incêndios LTDA',
    logs: []
  },
  {
    id: 'MNT-017',
    unitId: 'COMMON',
    title: 'Ajuste de rolamento do gerador principal',
    description: 'Manutenção de reparações corretivas que está atrasando peças qualificadas de montagem importada eletrônica.',
    category: 'electrical',
    priority: 'urgent',
    status: 'in_progress',
    reportedAt: '2026-04-10T08:00:00Z',
    assignedStaff: 'EnergyGer Geradores S/A',
    estimatedCost: 3500.00,
    logs: [
      { id: 'l1', author: 'Jefferson', comment: 'Ruído excessivo de vibração desarmou o relé térmico automático.', createdAt: '2026-04-10T08:15:00Z' },
      { id: 'l2', author: 'EnergyGer', comment: 'Peça de rolamento amortecedor central precisou ser importada, atrasando instalação final.', createdAt: '2026-04-20T17:00:00Z' }
    ]
  },
  {
    id: 'MNT-101',
    unitId: 'COMMON',
    title: 'Substituição das Câmeras da Portaria',
    description: 'Atualização das duas câmeras frontais analógicas para novos modelos IP Full HD de alta sensibilidade noturna.',
    category: 'security',
    priority: 'low',
    status: 'resolved',
    reportedAt: '2026-05-02T11:00:00Z',
    resolvedAt: '2026-05-05T14:30:00Z',
    assignedStaff: 'Vigilante Tech',
    estimatedCost: 950.00,
    actualCost: 920.00,
    logs: [
      { id: 'l1', author: 'Cassiano (Síndico)', comment: 'Aprovado pelo conselho do condomínio na reunião trimestral.', createdAt: '2026-05-02T11:00:00Z' },
      { id: 'l2', author: 'Vigilante Tech LLC', comment: 'Instalação efetuada com sucesso. Câmeras integradas no DVR principal.', createdAt: '2026-05-05T14:30:00Z' }
    ]
  },
  {
    id: 'MNT-102',
    unitId: 'COMMON',
    title: 'Manutenção Preventiva dos Elevadores',
    description: 'Manutenção bimestral regular dos elevadores dos blocos A e B para ajuste de nivelamento das portas e lubrificação das guias.',
    category: 'elevators',
    priority: 'medium',
    status: 'resolved',
    reportedAt: '2026-05-10T08:00:00Z',
    resolvedAt: '2026-05-12T16:00:00Z',
    assignedStaff: 'Atlas Schindler S.A.',
    estimatedCost: 1500.00,
    actualCost: 1500.00,
    logs: [
      { id: 'l1', author: 'Sistemas GCV', comment: 'Chamado agendado automaticamente baseado no contrato de serviços.', createdAt: '2026-05-10T08:00:00Z' },
      { id: 'l2', author: 'Cassiano (Síndico)', comment: 'Técnico realizou a manutenção das polias e reajuste eletrônico das portas do Bloco B. Tudo assinado e faturado.', createdAt: '2026-05-12T16:00:00Z' }
    ]
  },
  {
    id: 'MNT-103',
    unitId: 'COMMON',
    title: 'Reparo hidráulico torneira do vestiário',
    description: 'Conserto de torneira vazando intensamente com troca de vedante (reparo de silicone) e canopla no vestiário de funcionários comuns.',
    category: 'plumbing',
    priority: 'low',
    status: 'resolved',
    reportedAt: '2026-05-03T09:00:00Z',
    resolvedAt: '2026-05-04T11:00:00Z',
    estimatedCost: 180.00,
    actualCost: 180.00,
    logs: []
  },
  {
    id: 'MNT-104',
    unitId: 'COMMON',
    title: 'Revisão mecânica das exaustoras das garagens',
    description: 'Limpeza abrasiva das pás axiais, recalibração de tensionamento de polias e testes de acionamento por termostato na garagem G2.',
    category: 'electrical',
    priority: 'medium',
    status: 'resolved',
    reportedAt: '2026-05-01T10:00:00Z',
    resolvedAt: '2026-05-04T15:00:00Z',
    estimatedCost: 500.00,
    actualCost: 450.00,
    logs: []
  },
  {
    id: 'MNT-105',
    unitId: 'COMMON',
    title: 'Limpeza anual preventiva de calhas de teto',
    description: 'Desobstrução manual de folhas, poeiras e resíduos nas descidas pluviais da laje técnica do bloco A e B antes de frentes frias.',
    category: 'structural',
    priority: 'high',
    status: 'resolved',
    reportedAt: '2026-04-28T08:00:00Z',
    resolvedAt: '2026-05-02T16:00:00Z',
    estimatedCost: 800.00,
    actualCost: 800.00,
    logs: []
  },
  {
    id: 'MNT-106',
    unitId: 'COMMON',
    title: 'Eliminação de vazamento copa térreo',
    description: 'Veda-rosca de cano em PVC da pia de lavatórios secundários da copa administrativa apresentando vazamento por fadiga mecânica.',
    category: 'plumbing',
    priority: 'medium',
    status: 'resolved',
    reportedAt: '2026-04-25T11:00:00Z',
    resolvedAt: '2026-04-26T14:00:00Z',
    estimatedCost: 200.00,
    actualCost: 170.00,
    logs: []
  },
  {
    id: 'MNT-107',
    unitId: 'COMMON',
    title: 'Dedetização integral trimestral de pragas',
    description: 'Pulverização química atomizada contra insetos voadores, lagartas, brocas e baratas em ralos pluviais, fossos e garagens.',
    category: 'other',
    priority: 'medium',
    status: 'resolved',
    reportedAt: '2026-04-20T09:00:00Z',
    resolvedAt: '2026-04-22T17:00:00Z',
    estimatedCost: 1250.00,
    actualCost: 1200.00,
    logs: []
  }
];

export const INITIAL_EQUIPMENTS: Equipment[] = [
  { id: 'EQP-01', name: 'Bomba Centrífuga Principal', location: 'Casa de Bombas - Subsolo', category: 'Hidráulica', status: 'alert', lastInspection: '2026-04-15', nextInspection: '2026-06-15', installDate: '2021-08-10' },
  { id: 'EQP-02', name: 'Quadro Elétrico Geral', location: 'Sala Elétrica - Térreo', category: 'Elétrica / Cabine', status: 'critical', lastInspection: '2026-05-10', nextInspection: '2026-06-10', installDate: '2020-05-15' },
  { id: 'EQP-03', name: 'Gerador Principal de Emergência (350kVA)', location: 'Subsolo 1 - Área Técnica', category: 'Alternadores', status: 'maintenance', lastInspection: '2026-05-20', nextInspection: '2026-06-20', installDate: '2019-11-12' },
  { id: 'EQP-04', name: 'Exaustor de Fumaça G1', location: 'Garagem G1 - Tetos', category: 'Ventilação', status: 'maintenance', lastInspection: '2026-04-22', nextInspection: '2026-05-22', installDate: '2022-02-28' },
  { id: 'EQP-05', name: 'Pressurizador de Água Bloco A', location: 'Casa de Máquinas A - Cobertura', category: 'Hidráulica', status: 'alert', lastInspection: '2026-05-02', nextInspection: '2026-06-02', installDate: '2022-10-05' },
  { id: 'EQP-06', name: 'Portão Eletrônico Guarita', location: 'Entrada Veículos Principal', category: 'Mecânica', status: 'operational', lastInspection: '2026-05-12', nextInspection: '2026-06-12', installDate: '2023-01-20' },
  { id: 'EQP-07', name: 'Elevador Social Torre A (Atlas)', location: 'Hall de Elevadores Leste', category: 'Transporte', status: 'operational', lastInspection: '2026-05-12', nextInspection: '2026-06-12', installDate: '2020-03-30' },
  { id: 'EQP-08', name: 'Elevador Serviço Torre A (Atlas)', location: 'Hall de Elevadores Leste', category: 'Transporte', status: 'operational', lastInspection: '2026-05-12', nextInspection: '2026-06-12', installDate: '2020-03-30' },
  { id: 'EQP-09', name: 'Elevador Social Torre B (Atlas)', location: 'Hall de Elevadores Oeste', category: 'Transporte', status: 'operational', lastInspection: '2026-05-12', nextInspection: '2026-06-12', installDate: '2020-03-30' },
  { id: 'EQP-10', name: 'Elevador Serviço Torre B (Atlas)', location: 'Hall de Elevadores Oeste', category: 'Transporte', status: 'operational', lastInspection: '2026-05-12', nextInspection: '2026-06-12', installDate: '2020-03-30' },
  { id: 'EQP-11', name: 'Central de Detecção de Fumo', location: 'Anexo de Portaria', category: 'Segurança', status: 'operational', lastInspection: '2026-05-01', nextInspection: '2026-08-01', installDate: '2020-01-10' },
  { id: 'EQP-12', name: 'Sistemas CFTV (DVR - 32 canais)', location: 'Anexo de Portaria', category: 'Monitoramento', status: 'operational', lastInspection: '2026-05-05', nextInspection: '2026-07-05', installDate: '2023-05-15' },
  { id: 'EQP-13', name: 'Bomba Jockey Pressurizadora Incêndio', location: 'Casa de Bombas - Subsolo', category: 'Segurança Antifogo', status: 'operational', lastInspection: '2026-05-02', nextInspection: '2026-11-02', installDate: '2021-08-10' },
  { id: 'EQP-14', name: 'Filtro Areia Leste Piscina', location: 'Área Lazer Comum', category: 'Piscinas', status: 'operational', lastInspection: '2026-05-14', nextInspection: '2026-06-14', installDate: '2021-03-22' },
  { id: 'EQP-15', name: 'Cerca Elétrica Perimetral (12KV)', location: 'Muros Periféricos Linha', category: 'Segurança', status: 'operational', lastInspection: '2026-04-20', nextInspection: '2026-07-20', installDate: '2022-04-18' },
  { id: 'EQP-16', name: 'NoBreak Central Portaria (3kVA)', location: 'Guarita Técnica', category: 'T.I. / Redes', status: 'operational', lastInspection: '2026-04-25', nextInspection: '2026-10-25', installDate: '2022-07-09' },
  { id: 'EQP-17', name: 'Compressor de Ar Comprimido', location: 'Oficina do Zelador', category: 'Ferramental', status: 'operational', lastInspection: '2026-05-01', nextInspection: '2026-08-01', installDate: '2023-02-14' },
  { id: 'EQP-18', name: 'Caldeira a Gás Térmica Bloco A', location: 'Área Técnica Cobertura A', category: 'Aquecimento', status: 'operational', lastInspection: '2026-04-28', nextInspection: '2026-05-28', installDate: '2020-04-20' },
  { id: 'EQP-19', name: 'Caldeira a Gás Térmica Bloco B', location: 'Área Técnica Cobertura B', category: 'Aquecimento', status: 'operational', lastInspection: '2026-04-28', nextInspection: '2026-05-28', installDate: '2020-04-20' },
  { id: 'EQP-20', name: 'Iluminação Emergência Bateria Central', location: 'Salas de Maquinas', category: 'Elétrica', status: 'operational', lastInspection: '2026-05-02', nextInspection: '2026-08-02', installDate: '2020-01-10' },
  { id: 'EQP-21', name: 'Sensores Ativos de Presença Fachada', location: 'Perímetros Externos Jardim', category: 'Segurança', status: 'operational', lastInspection: '2026-05-15', nextInspection: '2026-08-15', installDate: '2023-11-20' },
  { id: 'EQP-22', name: 'Motorizado de Exaustão G2', location: 'Garagem G2 - Tetos', category: 'Ventilação', status: 'operational', lastInspection: '2026-05-04', nextInspection: '2026-06-04', installDate: '2022-02-28' },
  { id: 'EQP-23', name: 'Portas Automáticas Pivotantes Hall', location: 'Recepção Social Principal', category: 'Serralheria IP', status: 'operational', lastInspection: '2026-05-04', nextInspection: '2026-07-04', installDate: '2020-12-15' }
];

export const INITIAL_PLANS: MaintenancePlan[] = [
  { id: 'PLN-01', title: 'Manutenção Preditiva Termográfica Quadros Elétricos', description: 'Termometria infravermelha periódica nos contatos mecânicos dos barramentos primários do GCV.', frequency: 'semestral', nextOccurrence: '2026-08-10', status: 'active' },
  { id: 'PLN-02', title: 'Limpeza Semestral de Reservatórios d\'Água', description: 'Lavação sob pressão das torres internas e teste bacteriológico pós-desinfecção.', frequency: 'semestral', nextOccurrence: '2026-11-25', status: 'active' },
  { id: 'PLN-03', title: 'Aferição Bimestral dos Cabos de Tração Elevadores', description: 'Controle de alongação de vedações e nível de óleo do pistão hidráulico ATLAS.', frequency: 'monthly', nextOccurrence: '2026-06-12', status: 'active' },
  { id: 'PLN-04', title: 'Teste de Carga sob Estresse do Grupo Gerador Diesel', description: 'Simulação periódica de blecaute de rede estrutural com partida automática sob carga de 100%.', frequency: 'weekly', nextOccurrence: '2026-05-31', status: 'active' },
  { id: 'PLN-05', title: 'Limpeza e Inspeção Anual das Calhas Pluviais de Telhado', description: 'Liberação física de despojos vegetais em dreno de descida de águas pluviais.', frequency: 'annual', nextOccurrence: '2027-04-20', status: 'active' },
  { id: 'PLN-06', title: 'Renovação do AVCB (Corpo de Bombeiros SP)', description: 'Auditoria geral de segurança, mangueiras, extintores subterrâneos e vistorias gerais e comissão técnica.', frequency: 'annual', nextOccurrence: '2026-12-15', status: 'active' }
];

export const INITIAL_LOGS: OperationLog[] = [
  { id: 'LOG-01', title: 'Troca de Fusível de Proteção Bomba 2', content: 'Substituição de cartucho NH de 35A danificado por pico espúrio na fiação externa.', author: 'Zelador', createdAt: '2026-05-25T11:45:00Z', type: 'tech' },
  { id: 'LOG-02', title: 'Leitura Registrada do Consumidor Principal Sabesp', content: 'Leitura hidrômetro predial fechada em 1,452m³ para o mês de referência.', author: 'Zelador', createdAt: '2026-05-24T16:00:00Z', type: 'admin' },
  { id: 'LOG-03', title: 'Ronda de Escapes de Gás GLP Centralizada', content: 'Medição com detector portátil efetuada em todas as centrais coletivas. 100% estanque.', author: 'Zelador', createdAt: '2026-05-23T08:30:00Z', type: 'security' },
  { id: 'LOG-04', title: 'Substituição de Reator Eletrônico Lâmpada Garagem', content: 'Troca de reator bivolt 2x32W quebrado na vaga 40 do bloco A.', author: 'Zelador', createdAt: '2026-05-22T14:15:00Z', type: 'tech' },
  { id: 'LOG-05', title: 'Inspeção Semanal do Sistema Hidropneumático', content: 'Pressão nominal ajustada para 3.4 BAR. Válvula de alívio e segurança verificada e lubrificada.', author: 'Zelador', createdAt: '2026-05-21T10:00:00Z', type: 'tech' }
];

export const INITIAL_PURCHASES: PurchaseRequest[] = [
  { id: 'PR-01', title: 'Aquisição de Disjuntores Siemens 50A e Fiação Termo', supplier: 'Elétrica São Paulo S/A', items: '3x Disjuntor DIN Tripolar 50A, 10m de cabo flexível 10mm² antichama', amount: 485.60, status: 'approved', requester: 'Zelador', createdAt: '2026-05-20T10:00:00Z' },
  { id: 'PR-02', title: 'Filtros Descartáveis e Lonas Laváveis Piscina', supplier: 'Filtropic Piscinas Comerciais', items: '2x Cargas de Areia silícea filtrante de 25kg, 3L de clarificante', amount: 210.00, status: 'approved', requester: 'Zelador', createdAt: '2026-05-24T09:15:00Z' },
  { id: 'PR-03', title: 'Luminárias Balizadoras LED Herméticas', supplier: 'Luz & Cia Atacadista', items: '12x Luminária LED blindada IP65 18W para rampa de subsolo', amount: 649.00, status: 'pending', requester: 'Zelador', createdAt: '2026-05-25T15:30:00Z' },
  { id: 'PR-04', title: 'Pintura e Selador Coral para Portaria Interna', supplier: 'Tintas Universo LTDA', items: '1x Lata de Tinta Acrílica Coral Premium Titanium 18L, 1L de Thinner', amount: 395.00, status: 'pending', requester: 'Cassiano Marins', createdAt: '2026-05-26T08:00:00Z' }
];

export const INITIAL_PAYMENTS: PaymentOrder[] = [
  { id: 'PAY-01', description: 'Salários e Proventos Funcionários de Conservação', recipient: 'Folha Pagamento Funcionários', amount: 8450.00, dueDate: '2026-05-30', status: 'pending' },
  { id: 'PAY-02', description: 'Serviços de Terceirização de Portaria Integral', recipient: 'GuardaForte Vigilância LTDA', amount: 12800.00, dueDate: '2026-06-05', status: 'pending' },
  { id: 'PAY-03', description: 'Energia Elétrica Distribuidora Enel - Coletivo', recipient: 'Enel Distribuidora de Serviços', amount: 3450.25, dueDate: '2026-05-27', status: 'pending' },
  { id: 'PAY-04', description: 'Abono Contratos Manutenção Elevador Social', recipient: 'Atlas Schindler Serviços S.A.', amount: 1500.00, dueDate: '2026-05-15', status: 'paid' }
];
