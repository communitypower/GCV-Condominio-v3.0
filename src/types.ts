/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UnitType = 'apartment' | 'house' | 'penthouse';
export type UnitStatus = 'occupied' | 'vacant' | 'maintenance';

export interface Unit {
  id: string; // e.g. "A-101"
  block: string; // e.g. "Bloco A"
  number: string; // e.g. "101"
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  type: UnitType;
  status: UnitStatus;
  fractionalShare: number; // e.g. 0.0125 (fraço ideal)
}

export type BillingStatus = 'paid' | 'pending' | 'overdue';

export interface Billing {
  id: string;
  unitId: string;
  monthString: string; // e.g. "2026-05" (Maio/2026)
  amount: number;
  dueDate: string; // YYYY-MM-DD
  status: BillingStatus;
  paidAt?: string;
  issueDate: string;
  barcode: string;
  pixQrCode: string; // Simulated QR content or visual representation
  description: string;
  penaltyFee?: number; // multa
  interestFee?: number; // juros
  extraCharges?: { description: string; amount: number }[];
}

export type MaintenanceCategory = 'plumbing' | 'electrical' | 'elevators' | 'common_area' | 'security' | 'gardens' | 'structural' | 'other';
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';
export type MaintenanceStatus = 'reported' | 'in_progress' | 'resolved' | 'cancelled';

export interface MaintenanceLog {
  id: string;
  author: string;
  comment: string;
  createdAt: string;
}

export interface MaintenanceRequest {
  id: string;
  unitId: string; // target unit (or "COMMON" for common area)
  title: string;
  description: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  reportedAt: string;
  resolvedAt?: string;
  assignedStaff?: string;
  estimatedCost?: number;
  actualCost?: number;
  logs: MaintenanceLog[];
}

export interface Equipment {
  id: string;
  name: string;
  location: string;
  category: string;
  status: 'operational' | 'alert' | 'critical' | 'maintenance';
  lastInspection: string;
  nextInspection: string;
  installDate: string;
}

export interface MaintenancePlan {
  id: string;
  title: string;
  equipmentId?: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semestral' | 'annual';
  nextOccurrence: string;
  status: 'active' | 'suspended';
}

export interface OperationLog {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: string;
  type: 'tech' | 'admin' | 'security';
}

export interface PurchaseRequest {
  id: string;
  title: string;
  supplier: string;
  items: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requester: string;
  createdAt: string;
}

export interface PaymentOrder {
  id: string;
  description: string;
  recipient: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  paidAt?: string;
  createdAt?: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  type: 'urgent' | 'announcement' | 'system';
  createdAt: string;
}

export interface CondominiumSummary {
  totalUnits: number;
  occupiedUnits: number;
  maintenanceUnits: number;
  vacantUnits: number;
  totalRevenueThisMonth: number;
  pendingAmount: number;
  collectionRate: number; // percentage
  activeMaintenanceCount: number;
}

export interface Edificio {
  id: string;
  name: string;
  address: string;
  avatar: string;
  createdAt: string;
}
