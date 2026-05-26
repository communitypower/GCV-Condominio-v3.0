/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Building, 
  Users, 
  Receipt, 
  Wrench, 
  LogOut,
  Bell,
  Menu,
  X,
  Sparkles,
  RefreshCw,
  FolderSync,
  Layers,
  Calendar,
  Activity,
  FolderOpen,
  Box,
  AreaChart,
  ShoppingCart,
  CreditCard,
  Landmark,
  ShieldCheck,
  ArrowRight,
  Github
} from 'lucide-react';
import { Unit, Billing, MaintenanceRequest, Equipment, MaintenancePlan, OperationLog, PurchaseRequest, PaymentOrder, Edificio } from './types';
import { 
  INITIAL_UNITS, 
  INITIAL_BILLINGS, 
  INITIAL_MAINTENANCE,
  INITIAL_EQUIPMENTS,
  INITIAL_PLANS,
  INITIAL_LOGS,
  INITIAL_PURCHASES,
  INITIAL_PAYMENTS
} from './initialData';

// Component Imports
import Dashboard from './components/Dashboard';
import Residences from './components/Residences';
import BillingTracker from './components/BillingTracker';
import Maintenance from './components/Maintenance';
import Equipments from './components/Equipments';
import MaintenancePlans from './components/MaintenancePlans';
import OperationLogs from './components/OperationLogs';
import PurchaseRequests from './components/PurchaseRequests';
import PaymentOrders from './components/PaymentOrders';
import Demonstrativos from './components/Demonstrativos';
import Documentation from './components/Documentation';
import BimViewer from './components/BimViewer';
import LifecycleCosts from './components/LifecycleCosts';
import Notifications from './components/Notifications';
import Condominos from './components/Condominos';
import UsersList from './components/UsersList';
import AIAssistent from './components/AIAssistent';
import GitHubIntegration from './components/GitHubIntegration';

interface LoggedInUser {
  name: string;
  role: 'admin' | 'staff' | 'resident';
  avatar: string;
  description: string;
  unitId?: string;
}

const PRESET_USERS: LoggedInUser[] = [
  {
    name: 'Cassiano Marins',
    role: 'admin',
    avatar: 'CM',
    description: 'Síndico Geral / Profissional',
  },
  {
    name: 'Geraldo Nascimento',
    role: 'staff',
    avatar: 'GN',
    description: 'Zelador Predial Residente',
  },
  {
    name: 'Carlos Eduardo Ramos',
    role: 'resident',
    avatar: 'CR',
    description: 'Morador - A-101',
    unitId: 'A-101'
  }
];

export default function App() {
  // 17 Views Navigation types (including LLM AI assistant and GitHub integration)
  type TabType = 
    | 'dashboard' | 'edificios' | 'equipamentos'
    | 'planos' | 'ordens' | 'logs'
    | 'documentacao' | 'bim' | 'ciclovida' | 'compras'
    | 'condominos' | 'cobrancas' | 'pagamentos' | 'demonstrativos'
    | 'notificacoes' | 'usuarios' | 'ia_assistant' | 'github';

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // GitHub integration states
  const [githubToken, setGithubToken] = useState<string | null>(() => {
    return localStorage.getItem('gcv_github_token');
  });
  const [githubProfile, setGithubProfile] = useState<any | null>(() => {
    const saved = localStorage.getItem('gcv_github_profile');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // States for creating new buildings/edificios
  const [newEdificioModalOpen, setNewEdificioModalOpen] = useState(false);
  const [newEdificioName, setNewEdificioName] = useState('');
  const [newEdificioAddress, setNewEdificioAddress] = useState('');
  const [newEdificioAvatar, setNewEdificioAvatar] = useState('🏢');

  // Authentication states
  const [user, setUser] = useState<LoggedInUser | null>(() => {
    const saved = localStorage.getItem('gcv_logged_user');
    return saved ? JSON.parse(saved) : null;
  });

  // States initialized from localStorage or initial mock files, separated by building
  const [edificios, setEdificios] = useState<Edificio[]>(() => {
    const saved = localStorage.getItem('gcv_edificios');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      {
        id: 'bela_vista',
        name: 'Bela Vista Premium',
        address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
        avatar: '🏢',
        createdAt: '2026-05-01'
      },
      {
        id: 'morada_sol',
        name: 'Morada do Sol Residencial',
        address: 'Av. Atlântica, 4500 - Copacabana, Rio de Janeiro - RJ',
        avatar: '☀️',
        createdAt: '2026-05-15'
      }
    ];
  });

  const [activeEdificioId, setActiveEdificioId] = useState<string>(() => {
    return localStorage.getItem('gcv_active_edificio_id') || 'bela_vista';
  });

  const activeEdificio = edificios.find(e => e.id === activeEdificioId) || edificios[0];

  const [units, setUnits] = useState<Unit[]>([]);
  const [billings, setBillings] = useState<Billing[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRequest[]>([]);
  const [payments, setPayments] = useState<PaymentOrder[]>([]);
  
  // App simulated parameters
  const [currentMonth, setCurrentMonth] = useState('2026-05'); // Current active month simulation
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'info'} | null>(null);

  // Load and auto-transition states whenever activeEdificioId changes!
  useEffect(() => {
    localStorage.setItem('gcv_active_edificio_id', activeEdificioId);

    // 1. Units load
    const storedUnits = localStorage.getItem(`gcv_units_${activeEdificioId}`);
    let loadedUnits = INITIAL_UNITS;
    if (storedUnits) {
      try { loadedUnits = JSON.parse(storedUnits); } catch (e) {}
    } else {
      if (activeEdificioId !== 'bela_vista') {
        loadedUnits = [
          { id: '101', block: 'Torre A', number: '101', ownerName: 'Gisela Santos Araújo', ownerEmail: 'gisela@email.com', ownerPhone: '(11) 91234-5678', type: 'apartment', status: 'occupied', fractionalShare: 0.1 },
          { id: '102', block: 'Torre A', number: '102', ownerName: 'Fábio de Souza Junior', ownerEmail: 'fabio.jr@email.com', ownerPhone: '(11) 92345-6789', type: 'apartment', status: 'vacant', fractionalShare: 0.1 },
          { id: '201', block: 'Torre B', number: '201', ownerName: 'Clara Medeiros', ownerEmail: 'clara.m@email.com', ownerPhone: '(11) 93456-7890', type: 'penthouse', status: 'maintenance', fractionalShare: 0.2 }
        ];
      } else {
        loadedUnits = INITIAL_UNITS;
      }
    }
    setUnits(loadedUnits);

    // 2. Billings load
    const storedBillings = localStorage.getItem(`gcv_billings_${activeEdificioId}`);
    let loadedBillings = INITIAL_BILLINGS;
    if (storedBillings) {
      try { loadedBillings = JSON.parse(storedBillings); } catch (e) {}
    } else {
      if (activeEdificioId !== 'bela_vista') {
        loadedBillings = [
          {
            id: 'BIL-202605-101',
            unitId: '101',
            monthString: '2026-05',
            amount: 750.00,
            dueDate: '2026-05-10',
            status: 'paid',
            paidAt: '2026-05-09',
            issueDate: '2026-04-25',
            barcode: '34191.79001 01043.513184 91020.150008 7 97130000075000',
            pixQrCode: '00020101021226870014br.gov.bcb.pix...',
            description: 'Taxa Condominial Ordinária - Maio 2026'
          },
          {
            id: 'BIL-202605-102',
            unitId: '102',
            monthString: '2026-05',
            amount: 750.00,
            dueDate: '2026-05-10',
            status: 'pending',
            issueDate: '2026-04-25',
            barcode: '34191.79001 01043.513184 91020.150008 7 97130000075050',
            pixQrCode: '00020101021226870014br.gov.bcb.pix...',
            description: 'Taxa Condominial Ordinária - Maio 2026'
          }
        ];
      } else {
        loadedBillings = INITIAL_BILLINGS;
      }
    }

    // 3. Maintenance Requests load
    const storedMaintenance = localStorage.getItem(`gcv_maintenance_${activeEdificioId}`);
    let loadedMaintenance = INITIAL_MAINTENANCE;
    if (storedMaintenance) {
      try { loadedMaintenance = JSON.parse(storedMaintenance); } catch (e) {}
    } else {
      if (activeEdificioId !== 'bela_vista') {
        loadedMaintenance = [
          {
            id: 'MNT-001',
            unitId: 'COMMON',
            title: 'Reparo de Portão Eletrônico',
            description: 'Ajuste de sensor fim de curso do motor pivotante.',
            category: 'security',
            priority: 'high',
            status: 'reported',
            reportedAt: '2026-05-24T10:00:00Z',
            estimatedCost: 250.00,
            logs: []
          }
        ];
      } else {
        loadedMaintenance = INITIAL_MAINTENANCE;
      }
    }

    // 4. Equipments load
    const storedEquipments = localStorage.getItem(`gcv_equipments_${activeEdificioId}`);
    let loadedEquipments = INITIAL_EQUIPMENTS;
    if (storedEquipments) {
      try { loadedEquipments = JSON.parse(storedEquipments); } catch (e) {}
    } else {
      if (activeEdificioId !== 'bela_vista') {
        loadedEquipments = [
          { id: 'EQP-01', name: 'Motor Portão Social', location: 'Entrada Guarita', category: 'Segurança', status: 'operational', lastInspection: '2026-05-10', nextInspection: '2026-06-10', installDate: '2024-01-10' },
          { id: 'EQP-02', name: 'Bomba de Recalque Hidráulica', location: 'Subsolo', category: 'Hidráulica', status: 'alert', lastInspection: '2026-04-10', nextInspection: '2026-06-10', installDate: '2023-01-15' }
        ];
      } else {
        loadedEquipments = INITIAL_EQUIPMENTS;
      }
    }
    setEquipments(loadedEquipments);

    // 5. Plans load
    const storedPlans = localStorage.getItem(`gcv_plans_${activeEdificioId}`);
    let loadedPlans = INITIAL_PLANS;
    if (storedPlans) {
      try { loadedPlans = JSON.parse(storedPlans); } catch (e) {}
    } else {
      if (activeEdificioId !== 'bela_vista') {
        loadedPlans = [
          { id: 'PLN-01', title: 'Inspeção Hidráulica Mensal', description: 'Buscar vazamentos nos barramentos de teto e ralos.', frequency: 'monthly', nextOccurrence: '2026-06-15', status: 'active' }
        ];
      } else {
        loadedPlans = INITIAL_PLANS;
      }
    }
    setPlans(loadedPlans);

    // 6. Logs load
    const storedLogs = localStorage.getItem(`gcv_logs_${activeEdificioId}`);
    let loadedLogs = INITIAL_LOGS;
    if (storedLogs) {
      try { loadedLogs = JSON.parse(storedLogs); } catch (e) {}
    } else {
      if (activeEdificioId !== 'bela_vista') {
        loadedLogs = [
          { id: 'LOG-01', title: 'Inicialização do Acompanhamento', content: 'Início das coletas de manutenção para esta nova filial.', author: 'Zelador', createdAt: '2026-05-26T08:00:00Z', type: 'admin' }
        ];
      } else {
        loadedLogs = INITIAL_LOGS;
      }
    }
    setLogs(loadedLogs);

    // 7. Purchases load
    const storedPurchases = localStorage.getItem(`gcv_purchases_${activeEdificioId}`);
    let loadedPurchases = INITIAL_PURCHASES;
    if (storedPurchases) {
      try { loadedPurchases = JSON.parse(storedPurchases); } catch (e) {}
    } else {
      if (activeEdificioId !== 'bela_vista') {
        loadedPurchases = [];
      } else {
        loadedPurchases = INITIAL_PURCHASES;
      }
    }
    setPurchases(loadedPurchases);

    // 8. Payments load
    const storedPayments = localStorage.getItem(`gcv_payments_${activeEdificioId}`);
    let loadedPayments = INITIAL_PAYMENTS;
    if (storedPayments) {
      try { loadedPayments = JSON.parse(storedPayments); } catch (e) {}
    } else {
      if (activeEdificioId !== 'bela_vista') {
        loadedPayments = [];
      } else {
        loadedPayments = INITIAL_PAYMENTS;
      }
    }

    const simToday = '2026-05-26'; // Simulated current date based on prompt's date
    const autoCheckedBillings = loadedBillings.map(bil => {
      if (bil.status === 'pending' && bil.dueDate < simToday) {
        const penaltyFee = parseFloat((bil.amount * 0.02).toFixed(2)); // 2% penalty fee
        const interestFee = parseFloat((bil.amount * 0.01).toFixed(2)); // 1% simulated interest fee
        return {
          ...bil,
          status: 'overdue' as const,
          penaltyFee,
          interestFee,
        };
      }
      return bil;
    });

    const autoCheckedPayments = loadedPayments.map(p => {
      if (p.status === 'pending' && p.dueDate < simToday) {
        return { ...p, status: 'overdue' as const };
      }
      return p;
    });

    setBillings(autoCheckedBillings);
    setMaintenanceRequests(loadedMaintenance);
    setPayments(autoCheckedPayments);

    // Direct writes back to localStorage for sync
    localStorage.setItem(`gcv_units_${activeEdificioId}`, JSON.stringify(loadedUnits));
    localStorage.setItem(`gcv_billings_${activeEdificioId}`, JSON.stringify(autoCheckedBillings));
    localStorage.setItem(`gcv_maintenance_${activeEdificioId}`, JSON.stringify(loadedMaintenance));
    localStorage.setItem(`gcv_equipments_${activeEdificioId}`, JSON.stringify(loadedEquipments));
    localStorage.setItem(`gcv_plans_${activeEdificioId}`, JSON.stringify(loadedPlans));
    localStorage.setItem(`gcv_logs_${activeEdificioId}`, JSON.stringify(loadedLogs));
    localStorage.setItem(`gcv_purchases_${activeEdificioId}`, JSON.stringify(loadedPurchases));
    localStorage.setItem(`gcv_payments_${activeEdificioId}`, JSON.stringify(autoCheckedPayments));
  }, [activeEdificioId]);

  // Write handlers and dispatchers back to storage
  const saveUnitsToStorage = (updatedList: Unit[]) => {
    setUnits(updatedList);
    localStorage.setItem(`gcv_units_${activeEdificioId}`, JSON.stringify(updatedList));
  };

  const saveBillingsToStorage = (updatedList: Billing[]) => {
    setBillings(updatedList);
    localStorage.setItem(`gcv_billings_${activeEdificioId}`, JSON.stringify(updatedList));
  };

  const saveMaintenanceToStorage = (updatedList: MaintenanceRequest[]) => {
    setMaintenanceRequests(updatedList);
    localStorage.setItem(`gcv_maintenance_${activeEdificioId}`, JSON.stringify(updatedList));
  };

  const saveEquipmentsToStorage = (list: Equipment[]) => {
    setEquipments(list);
    localStorage.setItem(`gcv_equipments_${activeEdificioId}`, JSON.stringify(list));
  };

  const savePlansToStorage = (list: MaintenancePlan[]) => {
    setPlans(list);
    localStorage.setItem(`gcv_plans_${activeEdificioId}`, JSON.stringify(list));
  };

  const saveLogsToStorage = (list: OperationLog[]) => {
    setLogs(list);
    localStorage.setItem(`gcv_logs_${activeEdificioId}`, JSON.stringify(list));
  };

  const savePurchasesToStorage = (list: PurchaseRequest[]) => {
    setPurchases(list);
    localStorage.setItem(`gcv_purchases_${activeEdificioId}`, JSON.stringify(list));
  };

  const savePaymentsToStorage = (list: PaymentOrder[]) => {
    setPayments(list);
    localStorage.setItem(`gcv_payments_${activeEdificioId}`, JSON.stringify(list));
  };

  // Trigger brief alert notifications
  const triggerNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Operational Updates handlers
  
  // Units Updating (Save owner, fractional changes)
  const handleUpdateUnit = (updatedUnit: Unit) => {
    const updated = units.map(u => u.id === updatedUnit.id ? updatedUnit : u);
    saveUnitsToStorage(updated);
    triggerNotification(`Cadastro da unidade ${updatedUnit.id} atualizado com sucesso!`);
  };

  const handleAddUnit = (newUnit: Unit) => {
    if (units.some(u => u.id === newUnit.id)) {
      alert(`Unidade ${newUnit.id} já existe no cadastro.`);
      return;
    }
    const updated = [...units, newUnit];
    saveUnitsToStorage(updated);
    triggerNotification(`Nova unidade ${newUnit.id} cadastrada com sucesso!`);
  };

  // Billings Updating (Register payment/quittance)
  const handlePayBilling = (billingId: string, paidDateStr: string) => {
    const updated = billings.map(b => {
      if (b.id === billingId) {
        return {
          ...b,
          status: 'paid' as const,
          paidAt: paidDateStr,
        };
      }
      return b;
    });
    saveBillingsToStorage(updated);
    triggerNotification(`Boleto ${billingId.replace('BIL-', '')} quitado em ${new Date(paidDateStr + 'T12:00:00').toLocaleDateString('pt-BR')}!`);
  };

  const handleAddBilling = (newBilling: Billing) => {
    const updated = [newBilling, ...billings];
    saveBillingsToStorage(updated);
    triggerNotification(`Boleto cadastrado com sucesso para unidade ${newBilling.unitId}!`);
  };

  // Mass recurring invoicing for a month
  const handleMassGenerateBilling = (month: string) => {
    const occupiedUnits = units.filter(u => u.status === 'occupied' || u.status === 'maintenance');
    const existingBillingsOfThisMonth = billings.filter(b => b.monthString === month);

    let countGenerated = 0;
    const generatedBillings: Billing[] = [...billings];

    occupiedUnits.forEach(u => {
      const hasBill = existingBillingsOfThisMonth.some(b => b.unitId === u.id);
      if (!hasBill) {
        let standardAmount = 650.00;
        let desc = 'Taxa Condominial Ordinária';
        if (u.type === 'penthouse') {
          standardAmount = 1200.00;
          desc = 'Taxa Condominial Ordinária - Cobertura';
        } else if (u.type === 'house') {
          standardAmount = 850.00;
          desc = 'Taxa Condominial Ordinária - Residência';
        }

        const newBill: Billing = {
          id: `BIL-${month.replace('-', '')}-${u.id}`,
          unitId: u.id,
          monthString: month,
          amount: standardAmount,
          dueDate: `${month}-10`,
          status: 'pending',
          issueDate: `${month === '2026-06' ? '2026-05-25' : '2026-04-25'}`,
          barcode: '34191.79001 01043.513184 91020.150008 7 97130000' + Math.floor(standardAmount * 100).toString().padStart(6, '0'),
          pixQrCode: `00020101021226870014br.gov.bcb.pix2565pix-qr.gcvcondominio.com.br/cob/BIL${month.replace('-', '')}${u.id}520400005303986540${standardAmount.toFixed(2)}5802BR5914GCVCONDOMINIO6009SAOPAULO62070503BIL${month.replace('-', '')}${u.id}`,
          description: desc,
        };

        generatedBillings.unshift(newBill);
        countGenerated++;
      }
    });

    if (countGenerated > 0) {
      saveBillingsToStorage(generatedBillings);
      triggerNotification(`Faturamento executado! ${countGenerated} novos boletos adicionados.`);
    } else {
      triggerNotification(`Todos os boletos ativos para o mês de ${month} já foram gerados previamente.`, 'info');
    }
  };

  // Maintenance Ticket handlers
  const handleAddMaintenanceRequest = (newReq: MaintenanceRequest) => {
    const updated = [newReq, ...maintenanceRequests];
    saveMaintenanceToStorage(updated);
    triggerNotification(`Chamado de manutenção ${newReq.id} aberto com sucesso!`);
  };

  const handleUpdateMaintenanceRequest = (updatedReq: MaintenanceRequest) => {
    const updated = maintenanceRequests.map(r => r.id === updatedReq.id ? updatedReq : r);
    saveMaintenanceToStorage(updated);
    triggerNotification(`Chamado ${updatedReq.id} atualizado com sucesso.`);
  };

  // State Management Dispatches for newly created views
  const handleAddEquipment = (newEq: Equipment) => {
    const updated = [...equipments, newEq];
    saveEquipmentsToStorage(updated);
    triggerNotification(`Equipamento ${newEq.id} registrado com sucesso!`);
  };

  const handleUpdateEquipment = (updatedEq: Equipment) => {
    const updated = equipments.map(e => e.id === updatedEq.id ? updatedEq : e);
    saveEquipmentsToStorage(updated);
    triggerNotification(`Ativo ${updatedEq.id} re-parametrizado com sucesso!`);
  };

  const handleAddPlan = (newPlan: MaintenancePlan) => {
    const updated = [...plans, newPlan];
    savePlansToStorage(updated);
    triggerNotification(`Plano preventivo ${newPlan.id} agendado no calendário.`);
  };

  const handleTogglePlanStatus = (id: string) => {
    const updated = plans.map(p => {
      if (p.id === id) {
        return { ...p, status: p.status === 'active' ? 'suspended' as const : 'active' as const };
      }
      return p;
    });
    savePlansToStorage(updated);
    triggerNotification('Status do contrato de plano modificado.');
  };

  const handleDeletePlan = (id: string) => {
    const updated = plans.filter(p => p.id !== id);
    savePlansToStorage(updated);
    triggerNotification('Plano removido com sucesso.');
  };

  const handleAddLog = (newLog: OperationLog) => {
    const updated = [newLog, ...logs];
    saveLogsToStorage(updated);
    triggerNotification(`Ocorrência ${newLog.id} adicionada com sucesso!`);
  };

  const handleApprovePurchase = (id: string) => {
    const updated = purchases.map(p => {
      if (p.id === id) {
        return { ...p, status: 'approved' as const };
      }
      return p;
    });
    savePurchasesToStorage(updated);
    triggerNotification(`Requisição ${id} aprovada! Verba liberada.`);
  };

  const handleRejectPurchase = (id: string) => {
    const updated = purchases.map(p => {
      if (p.id === id) {
        return { ...p, status: 'rejected' as const };
      }
      return p;
    });
    savePurchasesToStorage(updated);
    triggerNotification(`Requisição ${id} cancelada.`);
  };

  const handleAddPurchase = (newReq: PurchaseRequest) => {
    const updated = [newReq, ...purchases];
    savePurchasesToStorage(updated);
    triggerNotification(`Lançada proposta de compra ${newReq.id} sob análise.`);
  };

  const handleAddPayment = (newPay: PaymentOrder) => {
    const updated = [newPay, ...payments];
    savePaymentsToStorage(updated);
    triggerNotification(`Ordem de Pagamento ${newPay.id} criada.`);
  };

  const handlePayPayment = (id: string) => {
    const updated = payments.map(p => {
      if (p.id === id) {
        return { ...p, status: 'paid' as const };
      }
      return p;
    });
    savePaymentsToStorage(updated);
    triggerNotification(`Fatura ${id} quitada e registrada no balanço!`);
  };

  // Authentication handlers
  const handleLogin = (selectedUser: LoggedInUser) => {
    setUser(selectedUser);
    localStorage.setItem('gcv_logged_user', JSON.stringify(selectedUser));
    setActiveTab('dashboard');
    triggerNotification(`Acesso autorizado! Bem-vindo(a), ${selectedUser.name}!`);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('gcv_logged_user');
    triggerNotification('Sessão encerrada com sucesso.');
  };

  // System State Reset to Mock defaults (Excellent helper utility)
  const handleResetSystemData = () => {
    if (confirm('Deseja realmente redefinir todos os dados cadastrais para o padrão de fábrica? Quaisquer modificações recentes serão perdidas.')) {
      localStorage.clear();
      setUnits(INITIAL_UNITS);
      setBillings(INITIAL_BILLINGS);
      setMaintenanceRequests(INITIAL_MAINTENANCE);
      setEquipments(INITIAL_EQUIPMENTS);
      setPlans(INITIAL_PLANS);
      setLogs(INITIAL_LOGS);
      setPurchases(INITIAL_PURCHASES);
      setPayments(INITIAL_PAYMENTS);
      setActiveTab('dashboard');
      triggerNotification('O sistema retornou com sucesso para a base original de dados!');
    }
  };

  const handleAddEdificio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEdificioName.trim()) return;

    const newId = newEdificioName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    const newEdificio: Edificio = {
      id: newId,
      name: newEdificioName,
      address: newEdificioAddress || 'Sem endereço registrado',
      avatar: newEdificioAvatar,
      createdAt: new Date().toISOString().split('T')[0]
    };

    const updated = [...edificios, newEdificio];
    setEdificios(updated);
    localStorage.setItem('gcv_edificios', JSON.stringify(updated));

    // Auto-switch to newly created building
    setActiveEdificioId(newId);
    setNewEdificioModalOpen(false);

    // Reset fields
    setNewEdificioName('');
    setNewEdificioAddress('');
    setNewEdificioAvatar('🏢');

    triggerNotification(`Edifício "${newEdificioName}" registrado com sucesso!`);
  };

  // Helper function to render active navigation styles
  const navBtnStyle = (tab: TabType) => {
    const active = activeTab === tab;
    return `w-full text-left px-4 py-2 text-xs font-semibold uppercase tracking-wider block rounded flex items-center gap-2.5 transition-all ${
      active 
        ? 'bg-[#10b981]/15 text-[#10b981] border-l-2 border-[#10b981] font-bold' 
        : 'text-zinc-400 hover:bg-white/5 opacity-80 hover:opacity-100'
    }`;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0B0D] flex items-center justify-center p-6 text-slate-300 font-sans select-none relative overflow-hidden">
        {/* Decorative background gradients */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#D4AF37]/5 blur-3xl rounded-full pointer-events-none"></div>
        
        <div className="w-full max-w-4xl bg-[#0F1115] border border-zinc-900 rounded-3xl overflow-hidden shadow-2xl relative z-10 p-8 sm:p-12 space-y-10">
          
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-[#10b981]/10 border border-[#10b981]/30 flex items-center justify-center text-[#10b981] mb-2">
              <Building className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white uppercase font-sans">
              GCV <span className="text-[#10b981]">Condomínio</span>
            </h1>
            <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Bella Vista Premium Suite • Central de Controle</p>
          </div>

          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-sans">Selecione seu Perfil de Acesso</h2>
              <p className="text-xs text-zinc-400 mt-1">Escolha uma das credenciais homologadas abaixo para testar o sistema cooperado</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PRESET_USERS.map((preset) => (
                <button
                  key={preset.role}
                  onClick={() => handleLogin(preset)}
                  className="bg-zinc-950/60 border border-zinc-850 hover:border-[#10b981]/60 p-6 rounded-2xl text-left hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col justify-between space-y-5 shadow-sm group"
                >
                  <div className="space-y-3 text-left">
                    <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      preset.role === 'admin' 
                        ? 'bg-[#10b981]/15 text-[#10b981]' 
                        : preset.role === 'staff'
                        ? 'bg-amber-950/20 text-amber-500'
                        : 'bg-emerald-950/20 text-emerald-400'
                    }`}>
                      {preset.role === 'admin' ? 'Administrador' : preset.role === 'staff' ? 'Equipe Zeladoria' : 'Morador'}
                    </span>

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-850 flex items-center justify-center font-bold text-xs text-white border border-zinc-800 group-hover:border-[#10b981]/25 shrink-0">
                        {preset.avatar}
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors leading-tight">{preset.name}</p>
                        <p className="text-[10px] text-zinc-500 font-semibold leading-tight mt-0.5">{preset.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-850/60 w-full flex items-center justify-between text-[11px] font-bold text-zinc-400 group-hover:text-[#10b981] transition-colors">
                    <span>Acessar Portal</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="text-center pt-2 border-t border-zinc-900">
            <p className="text-[10px] text-zinc-650 font-semibold tracking-wider uppercase">
              Aviso de Segurança • Acesso local simulado de alto padrão predial
            </p>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-slate-300 flex flex-col md:flex-row font-sans">
      {/* Top Banner alert notification triggers */}
      <div className="fixed top-4 right-4 z-50 max-w-sm pointer-events-none">
        {notification && (
          <div className="p-4 rounded-xl shadow-lg border text-xs font-semibold select-none flex items-center gap-2.5 bg-[#14161A] text-white border-slate-800/80 animate-bounce">
            <div className="bg-[#10b981] rounded-full p-1"><Sparkles className="w-4 h-4 text-white" /></div>
            <span>{notification.message}</span>
          </div>
        )}
      </div>
      <header className="md:hidden bg-[#0F1115] text-white shadow-md border-b border-slate-800/50 print:hidden sticky top-0 z-40">
        <div className="px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <span className="text-xl bg-[#10b981]/10 border border-[#10b981]/25 p-1.5 rounded-lg">
                {activeEdificio?.avatar || '🏢'}
              </span>
              <div>
                <select
                  value={activeEdificioId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__new__') {
                      setNewEdificioModalOpen(true);
                    } else {
                      setActiveEdificioId(val);
                    }
                  }}
                  className="font-sans font-bold text-xs bg-transparent text-[#E2E8F0] focus:outline-none cursor-pointer border-b border-zinc-800/40"
                >
                  {edificios.map(ed => (
                    <option key={ed.id} value={ed.id} className="bg-[#0F1115] text-white">
                      {ed.name}
                    </option>
                  ))}
                  <option value="__new__" className="bg-[#0F1115] text-[#10b981] font-bold">
                    + Novo Edifício
                  </option>
                </select>
                <span className="text-[8px] text-zinc-400 font-semibold tracking-wider uppercase block mt-0.5">Módulo Ativo</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleResetSystemData}
                title="Restaurar base original"
                className="p-1.5 rounded bg-slate-800/50 text-slate-400 hover:text-white"
              >
                <FolderSync className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-300"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu panel overlay */}
        {mobileMenuOpen && (
          <div className="bg-[#14161A] border-t border-slate-800/60 font-semibold px-4 pt-2 pb-4 space-y-2 text-xs max-h-[80vh] overflow-y-auto">
            {user.role === 'resident' ? (
              <>
                <button onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }} className={navBtnStyle('dashboard')}>Portal do Morador</button>
                <button onClick={() => { setActiveTab('ia_assistant'); setMobileMenuOpen(false); }} className={navBtnStyle('ia_assistant')}>Assistente IA Copilot ✨</button>
                <button onClick={() => { setActiveTab('ordens'); setMobileMenuOpen(false); }} className={navBtnStyle('ordens')}>Solicitar Reparos</button>
                <button onClick={() => { setActiveTab('notificacoes'); setMobileMenuOpen(false); }} className={navBtnStyle('notificacoes')}>Mural de Avisos</button>
              </>
            ) : (
              <>
                <button onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }} className={navBtnStyle('dashboard')}>Painel Geral</button>
                <button onClick={() => { setActiveTab('ia_assistant'); setMobileMenuOpen(false); }} className={navBtnStyle('ia_assistant')}>Assistente IA Copilot ✨</button>
                <button onClick={() => { setActiveTab('edificios'); setMobileMenuOpen(false); }} className={navBtnStyle('edificios')}>Imóveis ({units.length})</button>
                <button onClick={() => { setActiveTab('equipamentos'); setMobileMenuOpen(false); }} className={navBtnStyle('equipamentos')}>Equipamentos ({equipments.length})</button>
                <button onClick={() => { setActiveTab('planos'); setMobileMenuOpen(false); }} className={navBtnStyle('planos')}>Planos de Manutenção</button>
                <button onClick={() => { setActiveTab('ordens'); setMobileMenuOpen(false); }} className={navBtnStyle('ordens')}>Ordens de Serviço ({maintenanceRequests.length})</button>
                <button onClick={() => { setActiveTab('logs'); setMobileMenuOpen(false); }} className={navBtnStyle('logs')}>Logs de Operação</button>
                
                {user.role === 'admin' && (
                  <>
                    <button onClick={() => { setActiveTab('cobrancas'); setMobileMenuOpen(false); }} className={navBtnStyle('cobrancas')}>Cobranças</button>
                    <button onClick={() => { setActiveTab('pagamentos'); setMobileMenuOpen(false); }} className={navBtnStyle('pagamentos')}>Contas a Pagar</button>
                    <button onClick={() => { setActiveTab('demonstrativos'); setMobileMenuOpen(false); }} className={navBtnStyle('demonstrativos')}>Demonstrativos DRE</button>
                    <button onClick={() => { setActiveTab('condominos'); setMobileMenuOpen(false); }} className={navBtnStyle('condominos')}>Fichas Moradores</button>
                    <button onClick={() => { setActiveTab('usuarios'); setMobileMenuOpen(false); }} className={navBtnStyle('usuarios')}>Corpo Diretivo</button>
                    <button onClick={() => { setActiveTab('github'); setMobileMenuOpen(false); }} className={navBtnStyle('github')}>Integração GitHub</button>
                  </>
                )}
                <button onClick={() => { setActiveTab('notificacoes'); setMobileMenuOpen(false); }} className={navBtnStyle('notificacoes')}>Avisos & Mural</button>
              </>
            )}
            <button
              onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
              className="w-full text-left px-4 py-2 text-xs font-bold uppercase tracking-wider block rounded flex items-center gap-2.5 text-red-500 hover:bg-red-500/10 transition-all font-sans"
            >
              <LogOut className="w-3.5 h-3.5" /> Sair do Sistema
            </button>
          </div>
        )}
      </header>

      {/* Desktop Navigation Sidebar */}
      <aside className="hidden md:flex w-64 bg-[#0F1115] border-r border-slate-800/40 flex-col shrink-0 print:hidden select-none max-h-screen overflow-y-auto">
        <div className="p-5 border-b border-slate-850/60 space-y-4">
          <div>
            <h1 className="text-[#E2E8F0] text-lg font-black tracking-tight flex flex-col font-sans uppercase leading-tight">
              GCV
              <span className="text-[9px] tracking-[0.25em] font-sans font-medium uppercase mt-1 opacity-50">Multi-Edifícios</span>
            </h1>
          </div>

          {/* BUILDING SWITCHER CARD */}
          <div className="bg-zinc-950/70 border border-zinc-850 p-3 rounded-xl space-y-2">
            <span className="text-[8px] text-[#10b981] font-bold tracking-widest uppercase block">Edifício Ativo</span>
            
            <div className="flex items-center gap-2">
              <span className="text-lg shrink-0">{activeEdificio?.avatar || '🏢'}</span>
              <div className="min-w-0 flex-1">
                <select
                  value={activeEdificioId}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__new__') {
                      setNewEdificioModalOpen(true);
                    } else {
                      setActiveEdificioId(val);
                    }
                  }}
                  className="bg-transparent text-white font-bold text-xs w-full focus:outline-none cursor-pointer truncate"
                >
                  {edificios.map(ed => (
                    <option key={ed.id} value={ed.id} className="bg-[#0F1115] text-white py-1">
                      {ed.name}
                    </option>
                  ))}
                  <option value="__new__" className="bg-[#0F1115] text-[#10b981] font-bold">
                    + Cadastrar Edifício
                  </option>
                </select>
                <p className="text-[9px] text-zinc-500 font-semibold truncate leading-tight mt-0.5">
                  {activeEdificio?.address || 'Sem endereço'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar grouped navigational menu */}
        <div className="flex-1 px-4 space-y-4 pb-6 select-none text-[10px] font-bold text-zinc-500 tracking-wider">
          
          {user.role === 'resident' ? (
            /* RESTRICTED MORADOR SIDEBAR */
            <div className="space-y-1">
              <span className="px-4 block mb-1 uppercase tracking-widest text-[#10b981]">PORTAL DO MORADOR</span>
              <button onClick={() => setActiveTab('dashboard')} className={navBtnStyle('dashboard')}>
                <Building className="w-3.5 h-3.5" /> Meu Painel (A-101)
              </button>
              <button onClick={() => setActiveTab('ia_assistant')} className={navBtnStyle('ia_assistant')}>
                <Sparkles className="w-3.5 h-3.5 text-[#10b981]" /> Assistente IA ✨
              </button>
              <button onClick={() => setActiveTab('ordens')} className={navBtnStyle('ordens')}>
                <Wrench className="w-3.5 h-3.5" /> Solicitar Reparo
              </button>
              <button onClick={() => setActiveTab('notificacoes')} className={navBtnStyle('notificacoes')}>
                <Bell className="w-3.5 h-3.5" /> Mural de Avisos
              </button>
            </div>
          ) : (
            /* COMPREHENSIVE STAFF & ADMIN SIDEBAR */
            <>
              {/* Special IA Intelligence Group */}
              <div className="space-y-1">
                <span className="px-4 block mb-1 uppercase tracking-widest text-[#10b981] flex items-center gap-1">CO-PILOT IA</span>
                <button onClick={() => setActiveTab('ia_assistant')} className={navBtnStyle('ia_assistant')}>
                  <Sparkles className="w-3.5 h-3.5 text-[#10b981]" /> Assistente IA ✨
                </button>
              </div>

              {/* Group 1: OPERACIONAL */}
              <div className="space-y-1">
                <span className="px-4 block mb-1 uppercase tracking-widest text-[#10b981]">OPERACIONAL</span>
                <button onClick={() => setActiveTab('dashboard')} className={navBtnStyle('dashboard')}>
                  <Building className="w-3.5 h-3.5" /> Painel Geral
                </button>
                <button onClick={() => setActiveTab('edificios')} className={navBtnStyle('edificios')}>
                  <Building className="w-3.5 h-3.5" /> Edifícios / Imóveis
                </button>
                <button onClick={() => setActiveTab('equipamentos')} className={navBtnStyle('equipamentos')}>
                  <Wrench className="w-3.5 h-3.5" /> Equipamentos ({equipments.length})
                </button>
              </div>

              {/* Group 2: MANUTENÇÃO */}
              <div className="space-y-1">
                <span className="px-4 block mb-1 uppercase tracking-widest text-[#10b981]">MANUTENÇÃO</span>
                <button onClick={() => setActiveTab('planos')} className={navBtnStyle('planos')}>
                  <Calendar className="w-3.5 h-3.5" /> Planos Preventivos
                </button>
                <button onClick={() => setActiveTab('ordens')} className={navBtnStyle('ordens')}>
                  <Wrench className="w-3.5 h-3.5" /> Ordens de Serviço
                </button>
                <button onClick={() => setActiveTab('logs')} className={navBtnStyle('logs')}>
                  <Activity className="w-3.5 h-3.5" /> Logs de Operação
                </button>
              </div>

              {/* Group 3: ENGENHARIA */}
              <div className="space-y-1">
                <span className="px-4 block mb-1 uppercase tracking-widest text-[#10b981]">ENGENHARIA & BIM</span>
                <button onClick={() => setActiveTab('bim')} className={navBtnStyle('bim')}>
                  <Box className="w-3.5 h-3.5" /> Visualizador BIM 3D
                </button>
                <button onClick={() => setActiveTab('ciclovida')} className={navBtnStyle('ciclovida')}>
                  <AreaChart className="w-3.5 h-3.5" /> Ciclo de Vida LCC
                </button>
                <button onClick={() => setActiveTab('compras')} className={navBtnStyle('compras')}>
                  <ShoppingCart className="w-3.5 h-3.5" /> Compras / Insumos
                </button>
              </div>

              {/* Group 4: FINANCEIRO (Hidden for staff) */}
              {user.role === 'admin' && (
                <div className="space-y-1">
                  <span className="px-4 block mb-1 uppercase tracking-widest text-[#10b981]">FINANCEIRO</span>
                  <button onClick={() => setActiveTab('cobrancas')} className={navBtnStyle('cobrancas')}>
                    <Receipt className="w-3.5 h-3.5" /> Cobranças / Receitas
                  </button>
                  <button onClick={() => setActiveTab('pagamentos')} className={navBtnStyle('pagamentos')}>
                    <CreditCard className="w-3.5 h-3.5" /> Contas a Pagar
                  </button>
                  <button onClick={() => setActiveTab('demonstrativos')} className={navBtnStyle('demonstrativos')}>
                    <Landmark className="w-3.5 h-3.5" /> Demonstrativos DRE
                  </button>
                </div>
              )}

              {/* Group 5: CONDOMÍNIO */}
              <div className="space-y-1">
                <span className="px-4 block mb-1 uppercase tracking-widest text-[#10b981]">CONDOMÍNIO</span>
                {user.role === 'admin' && (
                  <button onClick={() => setActiveTab('condominos')} className={navBtnStyle('condominos')}>
                    <Users className="w-3.5 h-3.5" /> Fichas Moradores
                  </button>
                )}
                <button onClick={() => setActiveTab('documentacao')} className={navBtnStyle('documentacao')}>
                  <FolderOpen className="w-3.5 h-3.5" /> Documentação
                </button>
                <button onClick={() => setActiveTab('notificacoes')} className={navBtnStyle('notificacoes')}>
                  <Bell className="w-3.5 h-3.5" /> Mural de Avisos
                </button>
                {user.role === 'admin' && (
                  <button onClick={() => setActiveTab('usuarios')} className={navBtnStyle('usuarios')}>
                    <Users className="w-3.5 h-3.5" /> Corpo Diretivo / Staff
                  </button>
                )}
              </div>

              {/* Group 6: SISTEMA */}
              {user.role === 'admin' && (
                <div className="space-y-1">
                  <span className="px-4 block mb-1 uppercase tracking-widest text-[#10b981]">INTEGRAÇÕES</span>
                  <button onClick={() => setActiveTab('github')} className={navBtnStyle('github')}>
                    <Github className="w-3.5 h-3.5" /> Conexão GitHub
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Profile and System restoration tools */}
        <div className="p-6 border-t border-slate-800/40 select-none space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#10b981]/15 text-[#10b981] flex items-center justify-center font-bold text-xs border border-[#10b981]/30 shrink-0">
              {user.avatar}
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-white leading-tight">{user.name}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5 leading-tight">{user.description}</p>
            </div>
          </div>
          <div className="space-y-1.5 pt-2 border-t border-slate-800/20">
            <button
              onClick={handleLogout}
              className="w-full text-zinc-400 hover:text-red-400 bg-zinc-950/45 border border-zinc-900 hover:border-red-950/40 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all text-center"
            >
              <LogOut className="w-3 h-3" /> Encerrar Sessão
            </button>
            <button
              onClick={handleResetSystemData}
              title="Restaurar base original"
              className="w-full text-zinc-500 hover:text-[#10b981] hover:bg-white/5 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all text-center"
            >
              <FolderSync className="w-3 h-3" /> Redefinir Dados
            </button>
          </div>
        </div>
      </aside>

      {/* Main Viewport Content block */}
      <div className="flex-1 flex flex-col min-h-0 w-full overflow-y-auto h-screen">
        <main className="flex-1 px-4 sm:px-8 lg:px-10 py-10 w-full">
          {activeTab === 'dashboard' && (
            user.role === 'resident' ? (
              <div className="space-y-6 text-left">
                <div className="bg-[#14161A] border border-[#10b981]/20 p-6 rounded-2xl relative overflow-hidden">
                  <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 text-emerald-500/5 select-none pointer-events-none">
                    <Building className="w-64 h-64" />
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                    <div>
                      <span className="bg-[#10b981]/15 text-[#10b981] text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded">Portal do Condômino</span>
                      <h1 className="text-2xl font-bold tracking-tight text-white mt-1.5">Olá, {user.name}</h1>
                      <p className="text-zinc-400 text-xs mt-1">
                        Bem-vindo à sua área residencial privativa. Unidade ativa: <strong className="text-white">Apartamento A-101</strong> (Fração Ideal: 1.25%).
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setActiveTab('notificacoes')} className="bg-zinc-850 hover:bg-zinc-805 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 border border-zinc-800">
                        <Bell className="w-3.5 h-3.5" /> Mural de Avisos
                      </button>
                      <button onClick={() => setActiveTab('ia_assistant')} className="bg-[#10b981] hover:bg-emerald-400 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Conversar com IA
                      </button>
                    </div>
                  </div>
                </div>

                {/* Resident Split Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* My Billings card */}
                  <div className="bg-[#14161A] border border-zinc-850 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-[#10b981]" /> Minhas Cobranças
                      </h3>
                      <span className="text-[10px] text-[#10b981] font-semibold font-mono">Unidade A-101</span>
                    </div>

                    <div className="space-y-2.5">
                      {billings.filter(b => b.unitId === 'A-101').map((bill) => (
                        <div key={bill.id} className="bg-zinc-950/40 border border-zinc-855 p-4 rounded-xl flex items-center justify-between gap-4">
                          <div className="text-left">
                            <p className="text-xs font-bold text-white">{bill.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-zinc-450">Vencimento: <span className="font-mono text-zinc-400">{new Date(bill.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span></span>
                              <span className="text-[10.5px] text-zinc-700">|</span>
                              <span className="text-[10px] text-zinc-450">Fatura: <span className="font-mono text-zinc-400">{bill.id.replace('BIL-', '')}</span></span>
                            </div>
                          </div>

                          <div className="text-right flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs font-mono font-bold text-white">R$ {bill.amount.toFixed(2)}</p>
                              <span className={`inline-block text-[9px] font-bold uppercase tracking-wider mt-0.5 ${
                                bill.status === 'paid' ? 'text-emerald-400' : bill.status === 'overdue' ? 'text-red-400' : 'text-amber-500'
                              }`}>
                                {bill.status === 'paid' ? 'Pago' : bill.status === 'overdue' ? 'Atrasado' : 'Pendente'}
                              </span>
                            </div>
                            {bill.status !== 'paid' && (
                              <button
                                onClick={() => {
                                  handlePayBilling(bill.id, new Date().toISOString().split('T')[0]);
                                }}
                                className="bg-[#10b981]/15 text-[#10b981] hover:bg-[#10b981] hover:text-white hover:scale-101 px-3 py-1.5 text-[10px] font-bold rounded transition-all border border-[#10b981]/30"
                              >
                                Pagar Pix
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {billings.filter(b => b.unitId === 'A-101').length === 0 && (
                        <p className="text-xs text-zinc-500 py-4 text-center">Nenhuma cobrança registrada para a unidade.</p>
                      )}
                    </div>
                  </div>

                  {/* My Repair Tickets Card */}
                  <div className="bg-[#14161A] border border-zinc-850 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-[#10b981]" /> Minhas Solicitações de Reparo
                      </h3>
                      <span className="text-[10px] text-zinc-500 font-semibold font-mono">Chamados Ativos</span>
                    </div>

                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto">
                      {maintenanceRequests.filter(r => r.unitId === 'A-101').map((req) => (
                        <div key={req.id} className="bg-zinc-950/40 border border-zinc-850 p-3 rounded-lg flex items-center justify-between">
                          <div className="text-left">
                            <p className="text-xs font-bold text-white leading-normal">{req.title}</p>
                            <p className="text-[9.5px] text-zinc-500 mt-1">Abertura: {new Date(req.reportedAt + 'T12:00:00').toLocaleDateString('pt-BR')} • {req.category}</p>
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                              req.status === 'completed' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' : 'bg-amber-950/20 text-amber-500 border border-amber-900/40'
                            }`}>
                              {req.status === 'completed' ? 'Resolvido' : req.status === 'in_progress' ? 'Em Progresso' : 'Aberto'}
                            </span>
                          </div>
                        </div>
                      ))}

                      {maintenanceRequests.filter(r => r.unitId === 'A-101').length === 0 && (
                        <p className="text-xs text-zinc-500 py-4 text-center leading-normal">Você ainda não possui chamados de manutenção abertos.</p>
                      )}

                      <div className="pt-2">
                        <button 
                          onClick={() => setActiveTab('ordens')} 
                          className="w-full bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/20 text-xs font-bold py-2.5 rounded-lg border border-[#10b981]/25 transition-all flex items-center justify-center gap-1.5"
                        >
                          <Wrench className="w-4 h-4" /> Solicitar Novo Reparo Predial
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <Dashboard 
                equipments={equipments}
                requests={maintenanceRequests}
                onNavigate={(tab: any) => setActiveTab(tab)}
              />
            )
          )}

          {activeTab === 'edificios' && (
            <Residences 
              units={units}
              billings={billings}
              maintenanceRequests={maintenanceRequests}
              onUpdateUnit={handleUpdateUnit}
              onAddUnit={handleAddUnit}
            />
          )}

          {activeTab === 'equipamentos' && (
            <Equipments 
              equipments={equipments}
              onAddEquipment={handleAddEquipment}
              onUpdateEquipment={handleUpdateEquipment}
            />
          )}

          {activeTab === 'planos' && (
            <MaintenancePlans 
              plans={plans}
              onAddPlan={handleAddPlan}
              onToggleStatus={handleTogglePlanStatus}
              onDeletePlan={handleDeletePlan}
            />
          )}

          {activeTab === 'ordens' && (
            <Maintenance 
              units={units}
              requests={maintenanceRequests}
              onAddRequest={handleAddMaintenanceRequest}
              onUpdateRequest={handleUpdateMaintenanceRequest}
            />
          )}

          {activeTab === 'logs' && (
            <OperationLogs 
              logs={logs}
              onAddLog={handleAddLog}
            />
          )}

          {activeTab === 'documentacao' && (
            <Documentation />
          )}

          {activeTab === 'bim' && (
            <BimViewer 
              equipments={equipments}
              requests={maintenanceRequests}
            />
          )}

          {activeTab === 'ciclovida' && (
            <LifecycleCosts />
          )}

          {activeTab === 'compras' && (
            <PurchaseRequests 
              purchases={purchases}
              onApprove={handleApprovePurchase}
              onReject={handleRejectPurchase}
              onAddRequest={handleAddPurchase}
            />
          )}

          {activeTab === 'condominos' && (
            <Condominos />
          )}

          {activeTab === 'cobrancas' && (
            <BillingTracker 
              units={units}
              billings={billings}
              currentMonth={currentMonth}
              onPayBilling={handlePayBilling}
              onAddBilling={handleAddBilling}
              onMassGenerate={handleMassGenerateBilling}
            />
          )}

          {activeTab === 'pagamentos' && (
            <PaymentOrders 
              payments={payments}
              onAddPayment={handleAddPayment}
              onPay={handlePayPayment}
            />
          )}

          {activeTab === 'demonstrativos' && (
            <Demonstrativos />
          )}

          {activeTab === 'notificacoes' && (
            <Notifications />
          )}

          {activeTab === 'usuarios' && (
            <UsersList />
          )}

          {activeTab === 'ia_assistant' && (
            <AIAssistent 
              units={units}
              billings={billings}
              maintenanceRequests={maintenanceRequests}
              equipments={equipments}
              plans={plans}
              logs={logs}
              purchases={purchases}
              payments={payments}
              activeEdificioName={activeEdificio?.name || 'Bela Vista Premium'}
            />
          )}

          {activeTab === 'github' && (
            <GitHubIntegration
              githubToken={githubToken}
              githubProfile={githubProfile}
              onConnectSuccess={(token, profile) => {
                setGithubToken(token);
                setGithubProfile(profile);
                localStorage.setItem('gcv_github_token', token);
                localStorage.setItem('gcv_github_profile', JSON.stringify(profile));
              }}
              onDisconnect={() => {
                setGithubToken(null);
                setGithubProfile(null);
                localStorage.removeItem('gcv_github_token');
                localStorage.removeItem('gcv_github_profile');
              }}
              condoData={{
                unitsCount: units.length,
                paymentsCount: payments.length,
                maintenancePendingCount: maintenanceRequests.filter(r => r.status === 'pending').length,
                equipmentsCount: equipments.length,
                activeBuildingName: activeEdificio?.name || 'Bela Vista Premium',
                activeBuildingAddress: activeEdificio?.address || 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
                units,
                equipments,
                logs,
              }}
            />
          )}
        </main>

        <footer className="border-t border-slate-800/40 bg-[#0F1115]/40 py-6 text-center text-xs text-slate-500 font-semibold tracking-wide print:hidden">
          <p>GCV Condomínio • Central de Administração Predial {activeEdificio?.name || 'Bella Vista'}</p>
          <p className="mt-1 font-medium text-[10px] text-slate-600">© 2026. Todos os direitos reservados. Projeto operando na arquitetura de Alta Sofisticação Dark.</p>
        </footer>
      </div>

      {/* REGISTER NEW EDIFICIO MODAL */}
      {newEdificioModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in select-none">
          <div className="bg-[#0F1115] border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-4">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-[#10b981]" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Cadastrar Novo Edifício</h3>
              </div>
              <button
                onClick={() => setNewEdificioModalOpen(false)}
                className="text-zinc-400 hover:text-white transition-colors"
                id="close-edificio-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEdificio} className="space-y-4">
              <div className="space-y-1 text-left">
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Nome do Edifício</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Condomínio Solar da Barra"
                  value={newEdificioName}
                  onChange={(e) => setNewEdificioName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Endereço Completo</label>
                <input
                  type="text"
                  placeholder="Ex: Av. Lúcio Costa, 3400 - Barra da Tijuca, RJ"
                  value={newEdificioAddress}
                  onChange={(e) => setNewEdificioAddress(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 text-left">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Ícone / Avatar</label>
                  <select
                    value={newEdificioAvatar}
                    onChange={(e) => setNewEdificioAvatar(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 focus:border-[#10b981]/50 focus:ring-1 focus:ring-[#10b981]/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                  >
                    <option value="🏢">🏢 Edifício Comercial/Residencial</option>
                    <option value="🌇">🌇 Condomínio Urbano</option>
                    <option value="☀️">☀️ Morada Solar</option>
                    <option value="🌴">🌴 Resort / Praia</option>
                    <option value="🌳">🌳 Residencial Jardim</option>
                    <option value="🏰">🏰 Condomínio Fechado</option>
                    <option value="🏡">🏡 Casas / Vilas</option>
                  </select>
                </div>
                
                <div className="flex items-end">
                  <span className="text-zinc-500 text-[10px] italic pb-2">
                    Todos os cadastros serão isolados para este edifício.
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-850 flex gap-3">
                <button
                  type="button"
                  onClick={() => setNewEdificioModalOpen(false)}
                  className="flex-1 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white font-bold text-xs py-2.5 rounded-xl transition-all border border-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#10b981] hover:bg-emerald-400 text-white font-bold text-xs py-2.5 rounded-xl transition-all"
                >
                  Confirmar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
