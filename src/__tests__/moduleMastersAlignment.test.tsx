import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider } from '../context/AppContext';
import { BayProvider } from '../context/BayContext';
import { MastersMaintenancePage } from '../pages/MastersMaintenancePage';
import { MASTER_COLLECTIONS, WORKSHOP_MODULES, LOGICAL_MODULES } from '../data/masterCatalogue';

describe('Project Modules and Masters Alignment', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('all 41 masters have valid moduleCode matching WORKSHOP_MODULES and no orphans', () => {
    const validCodes = new Set(WORKSHOP_MODULES.map((m) => m.code));
    const validGroups = new Set(LOGICAL_MODULES.map((g) => g.id));

    expect(MASTER_COLLECTIONS.length).toBe(54);

    MASTER_COLLECTIONS.forEach((m) => {
      expect(validCodes.has(m.moduleCode)).toBe(true);
      expect(validGroups.has(m.logicalGroup)).toBe(true);
      expect(m.name).toBeTruthy();
      expect(m.category).toBeTruthy();
      expect(m.moduleName).toBeTruthy();
    });
  });

  it('WORKSHOP_MODULES exactly matches the 12 Transformation modules and their official order', () => {
    const expectedOrder = [
      'appointment',       // 1. Appointment Reminder
      'reception',         // 2. Pickup & Drop - Admin / Driver App
      'receptionist',      // 3. Receptionist
      'security',          // 4. Security Guard
      'jc_creation',       // 5. JC Creation- Mechanical
      'bodyshop',          // 6. JC Creation- Bodyshop
      'jc_tracking',       // 7. JC Tracking
      'eqc',               // 8. eQC / Washing
      'thd',               // 9. THD
      'spd',               // 10. SPD
      'claim',             // 11. Auth. Request Approval - Mobile / Web & Service Claims
      'customer_journey',  // 12. Customer Journey
    ];
    expect(WORKSHOP_MODULES.map((m) => m.code)).toEqual(expectedOrder);
  });

  it('correctly maps all 41 masters to their dedicated project modules in the official order', () => {
    const byModule: Record<string, string[]> = {};
    MASTER_COLLECTIONS.forEach((m) => {
      byModule[m.moduleCode] = byModule[m.moduleCode] || [];
      byModule[m.moduleCode].push(m.id);
    });

    // 1. Appointment Reminder: time slots, holiday calendar, cancellation LOV (3)
    expect(byModule['appointment']).toContain('holiday_calendar_master');
    expect(byModule['appointment']).toContain('time_slot_quotas_master');
    expect(byModule['appointment']).toContain('appointment_cancellation_lov');
    expect(byModule['appointment'].length).toBe(3);

    // 2. Pickup & Drop - Admin / Driver App: chauffeur transit (1)
    expect(byModule['reception']).toContain('driver_transit_roster');
    expect(byModule['reception'].length).toBe(1);

    // 3. Receptionist: customer greeting checklist (1)
    expect(byModule['receptionist']).toContain('lounge_reception_checklist');
    expect(byModule['receptionist'].length).toBe(1);

    // 4. Security Guard: gate inward/outward, gate denial LOV (2)
    expect(byModule['security']).toContain('gate_security_checklist');
    expect(byModule['security']).toContain('gate_denial_reasons');
    expect(byModule['security'].length).toBe(2);

    // 5. JC Creation- Mechanical: PPL, complaint codes, job codes, complaint linkage, repeat revisit (5)
    expect(byModule['jc_creation']).toContain('ppl_master');
    expect(byModule['jc_creation']).toContain('complaint_codes');
    expect(byModule['jc_creation']).toContain('job_codes');
    expect(byModule['jc_creation']).toContain('complaint_job_linkage');
    expect(byModule['jc_creation']).toContain('revisit_reasons');
    expect(byModule['jc_creation'].length).toBe(5);

    // 6. JC Creation- Bodyshop: all 6 bodyshop & paint masters (6)
    expect(byModule['bodyshop']).toContain('bodyshop_facility_master');
    expect(byModule['bodyshop']).toContain('bs_inventory_sections');
    expect(byModule['bodyshop']).toContain('bs_inventory_checkpoints');
    expect(byModule['bodyshop']).toContain('bs_insurance_documents');
    expect(byModule['bodyshop']).toContain('bodyshop_process_stages');
    expect(byModule['bodyshop']).toContain('paint_booth_schedule');
    expect(byModule['bodyshop'].length).toBe(6);

    // 7. JC Tracking: bays, divisions, technicians, pauses, model checklists (5)
    expect(byModule['jc_tracking']).toContain('bay_management_interactive');
    expect(byModule['jc_tracking']).toContain('bay_division_summary');
    expect(byModule['jc_tracking']).toContain('bay_technician');
    expect(byModule['jc_tracking']).toContain('pause_reasons');
    expect(byModule['jc_tracking']).toContain('model_checklists');
    expect(byModule['jc_tracking'].length).toBe(5);

    // 8. eQC / Washing: 9 quality check & EV safety masters (9)
    expect(byModule['eqc'].length).toBe(9);
    expect(byModule['eqc']).toContain('ev_safety_protocols');

    // 9. THD: plant helpdesk & telematics alerts (3) + 13 masters from the BA THD workbooks
    expect(byModule['thd']).toContain('thd_escalation_categories');
    expect(byModule['thd']).toContain('tib_bulletin_codes');
    expect(byModule['thd']).toContain('dtc_telematics_alerts');
    expect(byModule['thd']).toContain('thd_auto_trigger_rules');
    expect(byModule['thd']).toContain('thd_progress_sub_status');
    expect(byModule['thd'].length).toBe(16);

    // 10. SPD: 2 spare parts masters (2)
    expect(byModule['spd']).toContain('spd_issuance_priority');
    expect(byModule['spd']).toContain('parts_delay_reasons');
    expect(byModule['spd'].length).toBe(2);

    // 11. Auth. Request Approval & Service Claims: 3 warranty and AMC masters (3)
    expect(byModule['claim']).toContain('amc_pricing');
    expect(byModule['claim']).toContain('warranty_defect_codes');
    expect(byModule['claim']).toContain('goodwill_approval_limits');
    expect(byModule['claim'].length).toBe(3);

    // 12. Customer Journey: dealer details & network facility registry (1)
    expect(byModule['customer_journey']).toContain('dealer_details_registry');
    expect(byModule['customer_journey'].length).toBe(1);

    // Total = 41 masters accounted for
    const totalAssigned = Object.values(byModule).reduce((acc, list) => acc + list.length, 0);
    expect(totalAssigned).toBe(54);
  });

  it('renders 12 Project Modules alignment view and allows switching between modules and domains', async () => {
    const user = userEvent.setup();

    render(
      <AppProvider>
        <BayProvider>
          <MastersMaintenancePage />
        </BayProvider>
      </AppProvider>
    );

    // Verify the alignment mode buttons exist
    expect(screen.getByRole('tab', { name: /12 Project Modules/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /6 Logical Domains/i })).toBeInTheDocument();

    // Default mode is by_module: check for official project modules in the Transformation view
    expect(screen.getAllByText(/Appointment/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Security/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Receptionist/i).length).toBeGreaterThan(0);

    // Switch to 6 Logical Domains
    const domainsTab = screen.getByRole('tab', { name: /6 Logical Domains/i });
    await user.click(domainsTab);

    // Verify logical domain buttons exist
    expect(screen.getByRole('button', { name: /Vehicle & Product Data/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dealer Network & Facilities/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Service Operations & Floor/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Parts, Claims & Support/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /EQC Masters/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bodyshop Masters/i })).toBeInTheDocument();
  });
});
