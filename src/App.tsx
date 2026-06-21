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
  email: string;
  unitId?: string;
  accountId?: string;
  memberships?: any[];
}

const PRESET_USERS: LoggedInUser[] = [
  {
    name: 'Cassiano Marins',
    role: 'admin',
    avatar: 'CM',
    description: 'Síndico Geral / Profissional',
    email: 'sindico@gcv.com.br'
  },
  {
    name: 'Geraldo Nascimento',
    role: 'staff',
    avatar: 'GN',
    description: 'Zelador Predial Residente',
    email: 'zelador@gcv.com.br'
  },
  {
    name: 'Carlos Eduardo Ramos',
    role: 'resident',
    avatar: 'CR',
    description: 'Morador - A-101',
    email: 'carlos.ramos@email.com',
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
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);

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

  // Load user session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/v1/auth/me');
        if (response.ok) {
          const data = await response.json();
          const matchedPreset = PRESET_USERS.find(pu => pu.email === data.user.email);
          if (matchedPreset) {
            setUser({
              ...matchedPreset,
              accountId: data.user.memberships?.[0]?.accountId,
              memberships: data.user.memberships
            });
          } else {
            setUser({
              name: data.user.name,
              email: data.user.email,
              role: data.user.memberships[0]?.role === 'syndic' ? 'admin' : data.user.memberships[0]?.role === 'manager' ? 'staff' : 'resident',
              avatar: data.user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2),
              description: data.user.memberships[0]?.role || 'Morador',
              accountId: data.user.memberships?.[0]?.accountId,
              memberships: data.user.memberships
            });
          }
        } else {
          setUser(null);
          localStorage.removeItem('gcv_logged_user');
        }
      } catch (error) {
        console.error("Error loading session:", error);
      }
    };
    checkSession();
  }, []);

  // Fetch condominiums list when user is authenticated
  useEffect(() => {
    if (!user) return;
    const fetchCondos = async () => {
      try {
        const response = await fetch('/api/v1/condominiums');
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const mapped = data.map((c: any) => ({
              id: c.id,
              name: c.name,
              address: c.address,
              avatar: '🏢',
              createdAt: c.createdAt
            }));
            setEdificios(mapped);
            if (!mapped.some((e: any) => e.id === activeEdificioId)) {
              setActiveEdificioId(mapped[0].id);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching condominiums:", error);
      }
    };
    fetchCondos();
  }, [user]);

  // Load and auto-transition states whenever activeEdificioId changes!
  useEffect(() => {
    if (!user || !activeEdificioId) return;
    localStorage.setItem('gcv_active_edificio_id', activeEdificioId);

    const loadData = async () => {
      try {
        // 1. Units load
        const unitsRes = await fetch(`/api/v1/condominiums/${activeEdificioId}/units`);
        if (unitsRes.ok) {
          const loadedUnits = await unitsRes.json();
          const mappedUnits = loadedUnits.map((u: any) => {
            const ownerRel = u.relationships?.find((r: any) => r.role === 'owner');
            return {
              id: u.id,
              block: u.building?.name || 'Bloco',
              number: u.number,
              ownerName: ownerRel?.person?.name || 'Sem proprietário',
              ownerEmail: ownerRel?.person?.email || 'N/D',
              ownerPhone: ownerRel?.person?.phone || 'N/D',
              type: u.type,
              status: u.status,
              fractionalShare: u.fractionalShare
            };
          });
          setUnits(mappedUnits);
        }

        // 2. Billings load
        const chargesRes = await fetch(`/api/v1/condominiums/${activeEdificioId}/charges`);
        if (chargesRes.ok) {
          const loadedCharges = await chargesRes.json();
          const mappedBillings = loadedCharges.map((c: any) => ({
            id: c.id,
            unitId: c.unit?.number || 'Unidade',
            monthString: new Date(c.dueDate).toISOString().substring(0, 7),
            amount: c.amount,
            dueDate: new Date(c.dueDate).toISOString().split('T')[0],
            status: c.status,
            paidAt: c.paidAt ? new Date(c.paidAt).toISOString().split('T')[0] : undefined,
            issueDate: c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : undefined,
            barcode: c.barcode,
            pixQrCode: c.pixQrCode,
            description: c.description
          }));
          setBillings(mappedBillings);
        }

        // 3. Maintenance Requests load
        const ticketsRes = await fetch(`/api/v1/condominiums/${activeEdificioId}/tickets`);
        if (ticketsRes.ok) {
          const loadedTickets = await ticketsRes.json();
          const mappedTickets = loadedTickets.map((t: any) => ({
            id: t.id,
            unitId: t.unitId || 'COMMON',
            title: t.title,
            description: t.description,
            category: t.category,
            priority: t.priority,
            status: t.status,
            reportedAt: t.reportedAt,
            estimatedCost: t.estimatedCost,
            actualCost: t.actualCost,
            assignedStaff: t.assignedStaff,
            logs: t.comments?.map((comm: any) => ({
              id: comm.id,
              author: comm.authorName,
              comment: comm.comment,
              text: comm.comment,
              createdAt: comm.createdAt
            })) || []
          }));
          setMaintenanceRequests(mappedTickets);
        }

        // 4. Equipments load
        const eqRes = await fetch(`/api/v1/condominiums/${activeEdificioId}/equipment`);
        if (eqRes.ok) {
          const loadedEq = await eqRes.json();
          setEquipments(loadedEq);
        }

        // 5. Plans load
        const plansRes = await fetch(`/api/v1/condominiums/${activeEdificioId}/plans`);
        if (plansRes.ok) {
          const loadedPlans = await plansRes.json();
          setPlans(loadedPlans);
        }

        // 6. Logs load
        const accountId = user.accountId || user.memberships?.[0]?.accountId;
        if (accountId) {
          const auditRes = await fetch(`/api/v1/accounts/${accountId}/audit`);
          if (auditRes.ok) {
            const loadedLogs = await auditRes.json();
            const mappedLogs = loadedLogs.map((l: any) => {
              let category: 'tech' | 'admin' | 'security' = 'admin';
              if (['MaintenanceTicket', 'Equipment', 'MaintenancePlan'].includes(l.entity)) {
                category = 'tech';
              } else if (['User', 'Membership', 'Condominium', 'Building', 'Unit'].includes(l.entity)) {
                category = 'admin';
              } else {
                category = 'security';
              }
              return {
                id: l.id,
                title: `${l.action.toUpperCase()} - ${l.entity}`,
                content: l.details,
                author: l.userEmail || 'System',
                createdAt: l.createdAt,
                type: category
              };
            });
            setLogs(mappedLogs);
          }
        }
      } catch (error) {
        console.error("Error loading data from API:", error);
      }
    };
    loadData();

    // 7. Purchases load (Local state only)
    const storedPurchases = localStorage.getItem(`gcv_purchases_${activeEdificioId}`);
    let loadedPurchases = INITIAL_PURCHASES;
    if (storedPurchases) {
      try { loadedPurchases = JSON.parse(storedPurchases); } catch (e) {}
    } else {
      loadedPurchases = [];
    }
    setPurchases(loadedPurchases);

    // 8. Payments load (Local state only)
    const storedPayments = localStorage.getItem(`gcv_payments_${activeEdificioId}`);
    let loadedPayments = INITIAL_PAYMENTS;
    if (storedPayments) {
      try { loadedPayments = JSON.parse(storedPayments); } catch (e) {}
    } else {
      loadedPayments = [];
    }
    setPayments(loadedPayments);
  }, [activeEdificioId, user]);

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
  const handleUpdateUnit = async (updatedUnit: Unit) => {
    try {
      const response = await fetch(`/api/v1/condominiums/${activeEdificioId}/units/${updatedUnit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: updatedUnit.status,
          type: updatedUnit.type,
          fractionalShare: updatedUnit.fractionalShare,
          ownerName: updatedUnit.ownerName,
          ownerEmail: updatedUnit.ownerEmail,
          ownerPhone: updatedUnit.ownerPhone,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro ao atualizar unidade.');
      }

      // Reload units list
      const reloadRes = await fetch(`/api/v1/condominiums/${activeEdificioId}/units`);
      if (reloadRes.ok) {
        const loadedUnits = await reloadRes.json();
        const mappedUnits = loadedUnits.map((u: any) => {
          const ownerRel = u.relationships?.find((r: any) => r.role === 'owner');
          return {
            id: u.id,
            block: u.building?.name || 'Bloco',
            number: u.number,
            ownerName: ownerRel?.person?.name || 'Sem proprietário',
            ownerEmail: ownerRel?.person?.email || 'N/D',
            ownerPhone: ownerRel?.person?.phone || 'N/D',
            type: u.type,
            status: u.status,
            fractionalShare: u.fractionalShare
          };
        });
        setUnits(mappedUnits);
      }
      triggerNotification(`Cadastro da unidade ${updatedUnit.number} atualizado com sucesso!`);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleAddUnit = async (newUnit: Unit) => {
    try {
      // 1. Get buildings list for activeEdificioId
      const bRes = await fetch(`/api/v1/condominiums/${activeEdificioId}/buildings`);
      if (!bRes.ok) throw new Error('Erro ao buscar edifícios.');
      let buildings = await bRes.json();

      // 2. If no building exists, create one
      let buildingId = '';
      const blockName = newUnit.block || 'Bloco Principal';
      const existingBuilding = buildings.find((b: any) => b.name === blockName);
      if (existingBuilding) {
        buildingId = existingBuilding.id;
      } else {
        const createBRes = await fetch(`/api/v1/condominiums/${activeEdificioId}/buildings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: blockName }),
        });
        if (!createBRes.ok) throw new Error('Erro ao criar edifício.');
        const newB = await createBRes.json();
        buildingId = newB.id;
      }

      // 3. Create Unit
      const unitRes = await fetch(`/api/v1/condominiums/${activeEdificioId}/units`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: newUnit.number,
          type: newUnit.type,
          status: newUnit.status,
          fractionalShare: newUnit.fractionalShare,
          buildingId,
        }),
      });

      if (!unitRes.ok) {
        const err = await unitRes.json();
        throw new Error(err.error || 'Erro ao criar unidade.');
      }

      const createdUnit = await unitRes.json();

      // 4. Create Owner relationship if ownerName is provided
      if (newUnit.ownerName) {
        await fetch(`/api/v1/condominiums/${activeEdificioId}/residents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newUnit.ownerName,
            email: newUnit.ownerEmail || `${newUnit.ownerName.toLowerCase().replace(/\s+/g, '')}@example.com`,
            phone: newUnit.ownerPhone || 'N/D',
            unitId: createdUnit.id,
            role: 'owner',
          }),
        });
      }

      // Reload units list
      const reloadRes = await fetch(`/api/v1/condominiums/${activeEdificioId}/units`);
      if (reloadRes.ok) {
        const loadedUnits = await reloadRes.json();
        const mappedUnits = loadedUnits.map((u: any) => {
          const ownerRel = u.relationships?.find((r: any) => r.role === 'owner');
          return {
            id: u.id,
            block: u.building?.name || 'Bloco',
            number: u.number,
            ownerName: ownerRel?.person?.name || 'Sem proprietário',
            ownerEmail: ownerRel?.person?.email || 'N/D',
            ownerPhone: ownerRel?.person?.phone || 'N/D',
            type: u.type,
            status: u.status,
            fractionalShare: u.fractionalShare
          };
        });
        setUnits(mappedUnits);
      }
      triggerNotification(`Nova unidade ${newUnit.number} cadastrada com sucesso!`);
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Billings Updating (Register payment/quittance)
  const handlePayBilling = async (billingId: string, paidDateStr: string) => {
    try {
      const response = await fetch(`/api/v1/condominiums/${activeEdificioId}/charges/${billingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      });

      if (!response.ok) {
        throw new Error('Erro ao baixar boleto.');
      }

      // Reload billings
      const chargesRes = await fetch(`/api/v1/condominiums/${activeEdificioId}/charges`);
      if (chargesRes.ok) {
        const loadedCharges = await chargesRes.json();
        const mappedBillings = loadedCharges.map((c: any) => ({
          id: c.id,
          unitId: c.unit?.number || 'Unidade',
          monthString: new Date(c.dueDate).toISOString().substring(0, 7),
          amount: c.amount,
          dueDate: new Date(c.dueDate).toISOString().split('T')[0],
          status: c.status,
          paidAt: c.paidAt ? new Date(c.paidAt).toISOString().split('T')[0] : undefined,
          issueDate: c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : undefined,
          barcode: c.barcode,
          pixQrCode: c.pixQrCode,
          description: c.description
        }));
        setBillings(mappedBillings);
      }
      triggerNotification(`Boleto ${billingId.replace('BIL-', '')} quitado em ${new Date(paidDateStr + 'T12:00:00').toLocaleDateString('pt-BR')}!`);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleAddBilling = async (newBilling: Billing) => {
    try {
      const response = await fetch(`/api/v1/condominiums/${activeEdificioId}/charges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: newBilling.unitId,
          monthString: newBilling.monthString,
          amount: newBilling.amount,
          dueDate: newBilling.dueDate,
          description: newBilling.description,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro ao criar cobrança.');
      }

      // Reload billings
      const chargesRes = await fetch(`/api/v1/condominiums/${activeEdificioId}/charges`);
      if (chargesRes.ok) {
        const loadedCharges = await chargesRes.json();
        const mappedBillings = loadedCharges.map((c: any) => ({
          id: c.id,
          unitId: c.unit?.number || 'Unidade',
          monthString: new Date(c.dueDate).toISOString().substring(0, 7),
          amount: c.amount,
          dueDate: new Date(c.dueDate).toISOString().split('T')[0],
          status: c.status,
          paidAt: c.paidAt ? new Date(c.paidAt).toISOString().split('T')[0] : undefined,
          issueDate: c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : undefined,
          barcode: c.barcode,
          pixQrCode: c.pixQrCode,
          description: c.description
        }));
        setBillings(mappedBillings);
      }
      triggerNotification(`Boleto cadastrado com sucesso para unidade ${newBilling.unitId}!`);
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Mass recurring invoicing for a month
  const handleMassGenerateBilling = async (month: string) => {
    try {
      const response = await fetch(`/api/v1/condominiums/${activeEdificioId}/charges/mass-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthString: month }),
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar faturamento em massa.');
      }

      const result = await response.json();

      // Reload billings
      const chargesRes = await fetch(`/api/v1/condominiums/${activeEdificioId}/charges`);
      if (chargesRes.ok) {
        const loadedCharges = await chargesRes.json();
        const mappedBillings = loadedCharges.map((c: any) => ({
          id: c.id,
          unitId: c.unit?.number || 'Unidade',
          monthString: new Date(c.dueDate).toISOString().substring(0, 7),
          amount: c.amount,
          dueDate: new Date(c.dueDate).toISOString().split('T')[0],
          status: c.status,
          paidAt: c.paidAt ? new Date(c.paidAt).toISOString().split('T')[0] : undefined,
          issueDate: c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : undefined,
          barcode: c.barcode,
          pixQrCode: c.pixQrCode,
          description: c.description
        }));
        setBillings(mappedBillings);
      }

      if (result.countGenerated > 0) {
        triggerNotification(`Faturamento executado! ${result.countGenerated} novos boletos adicionados.`);
      } else {
        triggerNotification(`Todos os boletos ativos para o mês de ${month} já foram gerados previamente.`, 'info');
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Maintenance Ticket handlers
  const handleAddMaintenanceRequest = async (newReq: MaintenanceRequest) => {
    try {
      const response = await fetch(`/api/v1/condominiums/${activeEdificioId}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newReq.title,
          description: newReq.description,
          category: newReq.category,
          priority: newReq.priority,
          unitId: newReq.unitId === 'COMMON' ? null : newReq.unitId,
          estimatedCost: newReq.estimatedCost,
        }),
      });
      if (!response.ok) {
        throw new Error('Erro ao criar chamado de manutenção.');
      }
      const data = await response.json();
      
      const createdTicket = {
        id: data.id,
        unitId: data.unitId || 'COMMON',
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority,
        status: data.status,
        reportedAt: data.reportedAt,
        estimatedCost: data.estimatedCost,
        logs: []
      };
      setMaintenanceRequests([createdTicket, ...maintenanceRequests]);
      triggerNotification(`Chamado de manutenção ${data.id} aberto com sucesso!`);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleUpdateMaintenanceRequest = async (updatedReq: MaintenanceRequest) => {
    try {
      const originalReq = maintenanceRequests.find(r => r.id === updatedReq.id);
      if (!originalReq) return;

      if (updatedReq.logs.length > originalReq.logs.length) {
        const newComm = updatedReq.logs[updatedReq.logs.length - 1];
        const resComment = await fetch(`/api/v1/condominiums/${activeEdificioId}/tickets/${updatedReq.id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment: newComm.comment }),
        });
        if (!resComment.ok) {
          throw new Error('Erro ao adicionar comentário.');
        }
      }

      const resDetails = await fetch(`/api/v1/condominiums/${activeEdificioId}/tickets/${updatedReq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: updatedReq.status,
          assignedStaff: updatedReq.assignedStaff,
          estimatedCost: updatedReq.estimatedCost,
          actualCost: updatedReq.actualCost,
        }),
      });
      if (!resDetails.ok) {
        throw new Error('Erro ao atualizar detalhes do chamado.');
      }

      // Reload tickets list
      const ticketsRes = await fetch(`/api/v1/condominiums/${activeEdificioId}/tickets`);
      if (ticketsRes.ok) {
        const loadedTickets = await ticketsRes.json();
        const mappedTickets = loadedTickets.map((t: any) => ({
          id: t.id,
          unitId: t.unitId || 'COMMON',
          title: t.title,
          description: t.description,
          category: t.category,
          priority: t.priority,
          status: t.status,
          reportedAt: t.reportedAt,
          estimatedCost: t.estimatedCost,
          actualCost: t.actualCost,
          assignedStaff: t.assignedStaff,
          logs: t.comments?.map((comm: any) => ({
            id: comm.id,
            author: comm.authorName,
            comment: comm.comment,
            text: comm.comment,
            createdAt: comm.createdAt
          })) || []
        }));
        setMaintenanceRequests(mappedTickets);
      }
      triggerNotification(`Chamado ${updatedReq.id} atualizado com sucesso.`);
    } catch (error: any) {
      alert(error.message);
    }
  };

  // State Management Dispatches for newly created views
  const handleAddEquipment = async (newEq: Equipment) => {
    try {
      const response = await fetch(`/api/v1/condominiums/${activeEdificioId}/equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newEq.name,
          location: newEq.location,
          category: newEq.category,
          status: newEq.status,
          lastInspection: newEq.lastInspection,
          nextInspection: newEq.nextInspection,
          installDate: newEq.installDate,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao cadastrar equipamento.');
      }

      const eqRes = await fetch(`/api/v1/condominiums/${activeEdificioId}/equipment`);
      if (eqRes.ok) {
        const loadedEq = await eqRes.json();
        setEquipments(loadedEq);
      }
      triggerNotification(`Equipamento ${newEq.name} registrado com sucesso!`);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleUpdateEquipment = async (updatedEq: Equipment) => {
    try {
      const response = await fetch(`/api/v1/condominiums/${activeEdificioId}/equipment/${updatedEq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updatedEq.name,
          location: updatedEq.location,
          category: updatedEq.category,
          status: updatedEq.status,
          lastInspection: updatedEq.lastInspection,
          nextInspection: updatedEq.nextInspection,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar equipamento.');
      }

      const eqRes = await fetch(`/api/v1/condominiums/${activeEdificioId}/equipment`);
      if (eqRes.ok) {
        const loadedEq = await eqRes.json();
        setEquipments(loadedEq);
      }
      triggerNotification(`Ativo ${updatedEq.name} re-parametrizado com sucesso!`);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleAddPlan = async (newPlan: MaintenancePlan) => {
    try {
      const response = await fetch(`/api/v1/condominiums/${activeEdificioId}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId: newPlan.equipmentId,
          title: newPlan.title,
          description: newPlan.description,
          frequency: newPlan.frequency,
          nextOccurrence: newPlan.nextOccurrence,
          status: newPlan.status,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao cadastrar plano.');
      }

      const plansRes = await fetch(`/api/v1/condominiums/${activeEdificioId}/plans`);
      if (plansRes.ok) {
        const loadedPlans = await plansRes.json();
        setPlans(loadedPlans);
      }
      triggerNotification(`Plano preventivo ${newPlan.title} agendado no calendário.`);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleTogglePlanStatus = async (id: string) => {
    try {
      const plan = plans.find(p => p.id === id);
      if (!plan) return;
      const newStatus = plan.status === 'active' ? 'suspended' : 'active';
      const response = await fetch(`/api/v1/condominiums/${activeEdificioId}/plans/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Erro ao alternar status do plano.');
      }

      const plansRes = await fetch(`/api/v1/condominiums/${activeEdificioId}/plans`);
      if (plansRes.ok) {
        const loadedPlans = await plansRes.json();
        setPlans(loadedPlans);
      }
      triggerNotification('Status do contrato de plano modificado.');
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDeletePlan = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/condominiums/${activeEdificioId}/plans/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao remover plano.');
      }

      const plansRes = await fetch(`/api/v1/condominiums/${activeEdificioId}/plans`);
      if (plansRes.ok) {
        const loadedPlans = await plansRes.json();
        setPlans(loadedPlans);
      }
      triggerNotification('Plano removido com sucesso.');
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleAddLog = async (newLog: OperationLog) => {
    try {
      const accountId = user.accountId || user.memberships?.[0]?.accountId;
      if (!accountId) throw new Error('Conta não identificada.');
      const response = await fetch(`/api/v1/accounts/${accountId}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newLog.title,
          content: newLog.content,
          type: newLog.type,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao registrar entrada de log.');
      }

      const auditRes = await fetch(`/api/v1/accounts/${accountId}/audit`);
      if (auditRes.ok) {
        const loadedLogs = await auditRes.json();
        const mappedLogs = loadedLogs.map((l: any) => {
          let category: 'tech' | 'admin' | 'security' = 'admin';
          if (['MaintenanceTicket', 'Equipment', 'MaintenancePlan'].includes(l.entity)) {
            category = 'tech';
          } else if (['User', 'Membership', 'Condominium', 'Building', 'Unit'].includes(l.entity)) {
            category = 'admin';
          } else {
            category = 'security';
          }
          return {
            id: l.id,
            title: `${l.action.toUpperCase()} - ${l.entity}`,
            content: l.details,
            author: l.userEmail || 'System',
            createdAt: l.createdAt,
            type: category
          };
        });
        setLogs(mappedLogs);
      }
      triggerNotification(`Ocorrência registrada com sucesso!`);
    } catch (error: any) {
      alert(error.message);
    }
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
  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setLoginError("E-mail e senha são obrigatórios.");
      return;
    }

    setLoginLoading(true);
    setLoginError(null);

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao realizar login.');
      }

      const matchedPreset = PRESET_USERS.find(pu => pu.email === data.user.email);
      let enrichedUser: LoggedInUser;
      if (matchedPreset) {
        enrichedUser = {
          ...matchedPreset,
          accountId: data.user.memberships?.[0]?.accountId,
          memberships: data.user.memberships
        };
      } else {
        enrichedUser = {
          name: data.user.name,
          email: data.user.email,
          role: data.user.memberships[0]?.role === 'syndic' ? 'admin' : data.user.memberships[0]?.role === 'manager' ? 'staff' : 'resident',
          avatar: data.user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2),
          description: data.user.memberships[0]?.role || 'Morador',
          accountId: data.user.memberships?.[0]?.accountId,
          memberships: data.user.memberships
        };
      }

      setUser(enrichedUser);
      localStorage.setItem('gcv_logged_user', JSON.stringify(enrichedUser));
      setActiveTab('dashboard');
      triggerNotification(`Acesso autorizado! Bem-vindo(a), ${enrichedUser.name}!`);
    } catch (error: any) {
      setLoginError(error.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleMockLogin = async (selectedUser: LoggedInUser) => {
    try {
      const response = await fetch('/api/v1/auth/mock-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: selectedUser.email }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao realizar login.');
      }
      const enrichedUser = {
        ...selectedUser,
        accountId: data.user.memberships?.[0]?.accountId,
        memberships: data.user.memberships
      };
      setUser(enrichedUser);
      localStorage.setItem('gcv_logged_user', JSON.stringify(enrichedUser));
      setActiveTab('dashboard');
      triggerNotification(`Acesso autorizado! Bem-vindo(a), ${selectedUser.name}!`);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    setLoginError(null);
    const width = 500;
    const height = 650;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(
      '/api/v1/auth/google/login',
      'google_oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
    );
  };

  const handleMicrosoftLogin = () => {
    setMicrosoftLoading(true);
    setLoginError(null);
    const width = 500;
    const height = 650;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(
      '/api/v1/auth/microsoft/login',
      'microsoft_oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
    );
  };

  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.startsWith('http://127.0.0.1')) {
         return;
      }

      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS' || event.data?.type === 'MICROSOFT_AUTH_SUCCESS') {
        const { user: loggedUser } = event.data.payload;
        
        const matchedPreset = PRESET_USERS.find(pu => pu.email === loggedUser.email);
        let enrichedUser: LoggedInUser;
        if (matchedPreset) {
          enrichedUser = {
            ...matchedPreset,
            accountId: loggedUser.memberships?.[0]?.accountId,
            memberships: loggedUser.memberships
          };
        } else {
          enrichedUser = {
            name: loggedUser.name,
            email: loggedUser.email,
            role: loggedUser.memberships[0]?.role === 'syndic' ? 'admin' : loggedUser.memberships[0]?.role === 'manager' ? 'staff' : 'resident',
            avatar: loggedUser.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2),
            description: loggedUser.memberships[0]?.role || 'Morador',
            accountId: loggedUser.memberships?.[0]?.accountId,
            memberships: loggedUser.memberships
          };
        }

        setUser(enrichedUser);
        localStorage.setItem('gcv_logged_user', JSON.stringify(enrichedUser));
        setActiveTab('dashboard');
        setGoogleLoading(false);
        setMicrosoftLoading(false);
        triggerNotification(`Acesso autorizado! Bem-vindo(a), ${enrichedUser.name}!`);
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    }
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
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    return (
            <div className="min-h-screen bg-[#0A0B0D] flex items-center justify-center p-6 text-slate-300 font-sans select-none relative overflow-hidden">
              {/* Decorative background gradients */}
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none"></div>
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#D4AF37]/5 blur-3xl rounded-full pointer-events-none"></div>
              
              <div className="w-full max-w-5xl bg-[#0F1115] border border-zinc-900 rounded-3xl overflow-hidden shadow-2xl relative z-10 p-8 sm:p-12 space-y-10">
                
                <div className="text-center space-y-2">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-[#10b981]/10 border border-[#10b981]/30 flex items-center justify-center text-[#10b981] mb-2">
                    <Building className="w-6 h-6" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-white uppercase font-sans">
                    GCV <span className="text-[#10b981]">Condomínio</span>
                  </h1>
                  <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Bella Vista Premium Suite • Central de Controle</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
                  {/* CREDENTIALS LOGIN FORM */}
                  <div className={`${isLocalDev ? 'lg:col-span-6' : 'lg:col-span-8 lg:col-start-3 mx-auto w-full max-w-md'} space-y-6 flex flex-col justify-center`}>
                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-white uppercase tracking-wider font-sans">Acesso ao Portal</h2>
                      <p className="text-xs text-zinc-400">Entre com sua conta condominial cadastrada</p>
                    </div>

                    <div className="space-y-3">
                      <button
                        type="button"
                        disabled={googleLoading || microsoftLoading || loginLoading}
                        onClick={handleGoogleLogin}
                        className="w-full bg-zinc-950/70 border border-zinc-850 hover:border-[#10b981]/50 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-sm"
                      >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 6.16l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335" />
                        </svg>
                        {googleLoading ? <span>Conectando...</span> : <span>Continuar com Google</span>}
                      </button>

                      <button
                        type="button"
                        disabled={googleLoading || microsoftLoading || loginLoading}
                        onClick={handleMicrosoftLogin}
                        className="w-full bg-zinc-950/70 border border-zinc-850 hover:border-[#10b981]/50 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-sm"
                      >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 23 23" fill="currentColor">
                          <path d="M0 0h11v11H0z" fill="#F25022"/>
                          <path d="M12 0h11v11H12z" fill="#7FBA00"/>
                          <path d="M0 12h11v11H0z" fill="#00A4EF"/>
                          <path d="M12 12h11v11H12z" fill="#FFB900"/>
                        </svg>
                        {microsoftLoading ? <span>Conectando...</span> : <span>Continuar com Microsoft</span>}
                      </button>
                    </div>

                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-zinc-900"></div>
                      <span className="flex-shrink mx-4 text-[9px] text-zinc-550 font-bold uppercase tracking-wider">ou</span>
                      <div className="flex-grow border-t border-zinc-900"></div>
                    </div>

                    <form onSubmit={handleCredentialsLogin} className="space-y-4">
                      {loginError && (
                        <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-xl text-red-400 text-xs font-semibold">
                          {loginError}
                        </div>
                      )}
                      
                      <div className="space-y-1.5 text-left">
                        <label className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase block">E-mail</label>
                        <input
                          type="email"
                          required
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="exemplo@email.com"
                          className="w-full bg-zinc-950/70 border border-zinc-850 focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] rounded-xl px-4 py-3 text-xs text-white placeholder-zinc-650 focus:outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-1.5 text-left">
                        <label className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase block">Senha</label>
                        <input
                          type="password"
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="Sua senha"
                          className="w-full bg-zinc-950/70 border border-zinc-850 focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] rounded-xl px-4 py-3 text-xs text-white placeholder-zinc-650 focus:outline-none transition-all"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loginLoading || googleLoading || microsoftLoading}
                        className="w-full bg-[#10b981] hover:bg-[#0ea572] disabled:bg-emerald-850 disabled:text-zinc-400 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-950/25"
                      >
                        {loginLoading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Autenticando...</span>
                          </>
                        ) : (
                          <span>Entrar com E-mail</span>
                        )}
                      </button>
                    </form>
                  </div>

                  {isLocalDev && (
                    <>
                      {/* VERTICAL DIVIDER */}
                      <div className="hidden lg:block lg:col-span-1 w-px bg-zinc-900/80 my-2 self-stretch mx-auto"></div>

                      {/* MOCK PROFILES DEVELOPER PANEL */}
                      <div className="lg:col-span-5 space-y-6 flex flex-col justify-center">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] bg-amber-950/20 text-amber-500 border border-amber-900/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">DEV MODE</span>
                            <h2 className="text-base font-bold text-white uppercase tracking-wider font-sans">Acesso de Testes</h2>
                          </div>
                          <p className="text-xs text-zinc-400">Escolha um perfil homologado para testes rápidos locais</p>
                        </div>

                        <div className="space-y-3">
                          {PRESET_USERS.map((preset) => (
                            <button
                              key={preset.role}
                              type="button"
                              onClick={() => handleMockLogin(preset)}
                              className="w-full bg-zinc-950/40 border border-zinc-850 hover:border-[#10b981]/50 p-4 rounded-xl text-left hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-between shadow-sm group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-zinc-850 flex items-center justify-center font-bold text-xs text-white border border-zinc-800 shrink-0">
                                  {preset.avatar}
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-white leading-tight group-hover:text-[#10b981] transition-colors">{preset.name}</p>
                                  <p className="text-[9px] text-zinc-500 font-semibold leading-tight mt-0.5">{preset.description}</p>
                                </div>
                              </div>
                              <ArrowRight className="w-3.5 h-3.5 text-zinc-550 group-hover:text-[#10b981] group-hover:translate-x-0.5 transition-all" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
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
            <Documentation condoId={activeEdificioId} />
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
            <Condominos condoId={activeEdificioId} units={units} />
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
