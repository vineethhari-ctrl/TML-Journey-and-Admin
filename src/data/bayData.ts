import { Bay, BayAllocation, BayRequest, BayState, DEFAULT_POLICY, buildApprovalEmail } from '../utils/bayGovernance';

/** Divisions per dealer (a dealer can run several workshops / divisions). */
export const DEALER_DIVISIONS: Record<string, string[]> = {
  DLR1001: ['Main Workshop', 'EV Hub'],
  DLR1002: ['Main Workshop'],
  DLR1003: ['Main Workshop', 'Body Shop Division'],
  DLR1004: ['Main Workshop'],
  DLR1005: ['Main Workshop'],
};

const base = {
  region: 'South' as const,
  dealerCode: 'DLR1001',
  dealerName: 'Sample Motors Hyderabad',
  specialEquipments: [] as string[],
};

export const SEED_BAYS: Bay[] = [
  { ...base, id: 'BAY-01', no: 1, division: 'Main Workshop', bu: 'PV', bayName: 'Mechanical Bay 01', bayType: 'Mechanical', bayStatus: 'Active', approvalStatus: 'Approved', floor: 'Floor 1', liftAvailability: '2 post lift', specialEquipments: ['Nut Runner', 'Oil Dispensing Unit'], techSupervisor: 'Ram', tech1: 'Shyam', tech2: 'Rohit' },
  { ...base, id: 'BAY-02', no: 2, division: 'Main Workshop', bu: 'PV', bayName: 'Mechanical Bay 02', bayType: 'Mechanical', bayStatus: 'Active', approvalStatus: 'Approved', floor: 'Floor 1', liftAvailability: '2 post lift', specialEquipments: ['Nut Runner', 'Brake rivet machine'], techSupervisor: 'Ram', tech1: 'Sunil Kumar', tech2: 'Anil Rao' },
  { ...base, id: 'BAY-03', no: 3, division: 'Main Workshop', bu: 'PV', bayName: 'Electrical Bay 01', bayType: 'Electrical', bayStatus: 'Inactive', approvalStatus: 'Pending Approval', pendingRequestId: 'BREQ-SEED-01', floor: 'Floor 1', liftAvailability: 'No Lift', specialEquipments: ['Nut Runner', 'EV Charger'], techSupervisor: 'Madhu', tech1: 'Raghavan K', tech2: 'Venkat S' },
  { ...base, id: 'BAY-04', no: 4, division: 'EV Hub', bu: 'EV', bayName: 'EV High-Voltage Bay 01', bayType: 'EV', bayStatus: 'Active', approvalStatus: 'Approved', floor: 'Floor 1', liftAvailability: '2 post lift', specialEquipments: ['EV Charger', 'Nut Runner', 'Oil Dispensing Unit'], techSupervisor: 'Madhu', tech1: 'Arjun Das (EV Level 3)', tech2: 'Kiran Verma' },
  { ...base, id: 'BAY-05', no: 5, division: 'Main Workshop', bu: 'CV', bayName: 'Fleet Service Bay 01', bayType: 'Fleet', bayStatus: 'Active', approvalStatus: 'Approved', floor: 'Floor 1', liftAvailability: '4 post lift', specialEquipments: ['Nut Runner', 'Brake rivet machine'], techSupervisor: 'Ram', tech1: 'Gopal S', tech2: 'Manoj P' },
  { ...base, id: 'BAY-06', no: 6, division: 'Main Workshop', bu: 'PV', bayName: 'Speedo Express Bay 01', bayType: 'Speedo', bayStatus: 'Active', approvalStatus: 'Approved', floor: 'Floor 1', liftAvailability: '2 post lift', specialEquipments: ['Oil Dispensing Unit', 'Nut Runner'], techSupervisor: 'Madhu', tech1: 'Mahesh Reddy', tech2: 'Devendra T' },
  { ...base, id: 'BAY-07', no: 7, division: 'Main Workshop', bu: 'PV', bayName: 'Air Conditioning Bay 01', bayType: 'AC', bayStatus: 'Active', approvalStatus: 'Approved', floor: 'Floor 1', liftAvailability: 'No Lift', specialEquipments: ['Nut Runner'], techSupervisor: 'Ram', tech1: 'Santosh Kumar', tech2: 'Naveen B' },
  { ...base, id: 'BAY-08', no: 8, division: 'Main Workshop', bu: 'PV', bayName: 'BodyShop Paint Prep 01', bayType: 'BodyShop', bayStatus: 'Inactive', approvalStatus: 'Rejected', floor: 'Basement', liftAvailability: 'No Lift', specialEquipments: ['Brake rivet machine'], techSupervisor: 'Madhu', tech1: 'Premchand', tech2: 'Farhan Ali' },
  { ...base, id: 'BAY-10', no: 10, division: 'Main Workshop', bu: 'PV', bayName: 'Quick Service Bay 01', bayType: 'Mechanical', bayStatus: 'Inactive', approvalStatus: 'Draft', floor: 'Ground', liftAvailability: '2 post lift', specialEquipments: ['Nut Runner'], techSupervisor: 'Ram', tech1: 'Imran S', tech2: '' },
  { ...base, id: 'BAY-09', no: 9, division: 'Main Workshop', bu: 'PV', bayName: 'BodyShop Denting 01', bayType: 'BodyShop', bayStatus: 'Active', approvalStatus: 'Approved', floor: 'Basement', liftAvailability: '2 post lift', specialEquipments: ['Nut Runner', 'Brake rivet machine'], techSupervisor: 'Ram', tech1: 'Kishore J', tech2: 'Sanjay Rawat' },
];

const alloc = (id: string, division: string, bu: BayAllocation['bu'], bayType: BayAllocation['bayType'], allocated: number): BayAllocation => ({
  id,
  dealerCode: 'DLR1001',
  division,
  bu,
  bayType,
  allocated,
  updatedBy: 'TML Network Planning',
  updatedAt: '2026-09-15 10:00',
});

export const SEED_ALLOCATIONS: BayAllocation[] = [
  alloc('ALLOC-01', 'Main Workshop', 'PV', 'Mechanical', 4),
  alloc('ALLOC-02', 'Main Workshop', 'PV', 'Electrical', 0),
  alloc('ALLOC-03', 'Main Workshop', 'PV', 'Speedo', 1),
  alloc('ALLOC-04', 'Main Workshop', 'PV', 'AC', 1),
  alloc('ALLOC-05', 'Main Workshop', 'PV', 'BodyShop', 2),
  alloc('ALLOC-06', 'Main Workshop', 'CV', 'Fleet', 2),
  alloc('ALLOC-07', 'EV Hub', 'EV', 'EV', 2),
];

const seedRequest: BayRequest = {
  id: 'BREQ-SEED-01',
  kind: 'ADD_BAY',
  bayId: 'BAY-03',
  bayName: 'Electrical Bay 01',
  dealerCode: 'DLR1001',
  dealerName: 'Sample Motors Hyderabad',
  division: 'Main Workshop',
  bu: 'PV',
  bayType: 'Electrical',
  reason: 'Rising electrical diagnostics load from the new Nexon/Punch fleet; no Electrical bay in the current allocation.',
  allocation: { allocated: 0, used: 0 },
  approverRole: 'TML Network Manager',
  requestedBy: { name: 'K. Venkatesh', role: 'DEALER_ADMIN', email: 'k.venkatesh@prerana.tatamotors.com' },
  requestedAt: '2026-09-29 16:20',
  status: 'PENDING',
};

export function createSeedBayState(appBaseUrl: string): BayState {
  return {
    bays: SEED_BAYS,
    allocations: SEED_ALLOCATIONS,
    requests: [seedRequest],
    emails: [buildApprovalEmail(seedRequest, appBaseUrl, '2026-09-29 16:20')],
    policy: DEFAULT_POLICY,
  };
}
