import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider } from '../context/AppContext';
import { BayProvider } from '../context/BayContext';
import { BodyshopMaster } from '../components/administration/BodyshopMaster';
import { MastersMaintenancePage } from '../pages/MastersMaintenancePage';

describe('BodyshopMaster Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders body shop facility data including capacity, denting stalls, and paint booths', () => {
    render(
      <AppProvider>
        <BodyshopMaster />
      </AppProvider>
    );

    expect(screen.getAllByText(/Bodyshop Master Management Console/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sample Motors Hyderabad/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Basement Bodyshop Complex/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Denting Stalls/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Paint Booths/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Chassis Jigs/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Max Simultaneous Repairs/i).length).toBeGreaterThan(0);
  });

  it('allows switching to specialized tools tab and displays available specialized tools and calibration', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <BodyshopMaster />
      </AppProvider>
    );

    const toolsTab = screen.getByRole('button', { name: /Specialized Tools & Jigs/i });
    await user.click(toolsTab);

    expect(screen.getAllByText(/Car-O-Liner BenchRack/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Blowtherm Extra Downdraft Heated Paint Spray Booth/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Wieländer\+Schill Inverter Resistance Spot Welder/i).length).toBeGreaterThan(0);
  });

  it('allows switching to lead technician assignments tab and displays certifications and assigned bays', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <BodyshopMaster />
      </AppProvider>
    );

    const techTab = screen.getByRole('button', { name: /Lead Techs & Rosters/i });
    await user.click(techTab);

    expect(screen.getAllByText(/Ramachandran M/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Premchand/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tata Gold Master Bodyshop/i).length).toBeGreaterThan(0);
  });

  it('integrates within MastersMaintenancePage via open=bodyshop parameter', async () => {
    window.location.hash = '#/admin/masters?open=bodyshop';

    render(
      <AppProvider>
        <BayProvider>
          <MastersMaintenancePage />
        </BayProvider>
      </AppProvider>
    );

    expect(screen.getAllByText(/Bodyshop Master & Facility Operations/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bodyshop Master Management Console/i).length).toBeGreaterThan(0);
  });
});
