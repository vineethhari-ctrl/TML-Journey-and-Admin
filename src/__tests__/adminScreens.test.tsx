import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider, useApp } from '../context/AppContext';
import { BayProvider } from '../context/BayContext';
import { MasterDataImportModal } from '../components/administration/MasterDataImportModal';
import { MasterTableEditor } from '../components/administration/MasterTableEditor';
import { BulkEditModal } from '../components/administration/BulkEditModal';
import { RulesEngineStudio } from '../components/administration/RulesEngineStudio';
import { Pagination } from '../components/common/Pagination';
import { MastersMaintenancePage } from '../pages/MastersMaintenancePage';
import { MasterConfig } from '../data/masterCatalogue';

const wrap = (ui: React.ReactElement) => render(<AppProvider>{ui}</AppProvider>);

const sampleMaster: MasterConfig = {
  id: 'test_master',
  name: 'Test Master',
  owner: 'DEALER_ADMIN',
  category: 'Test',
  logicalGroup: 'Vehicle Data',
  moduleCode: 'jc_tracking',
  moduleName: 'Test Module',
  description: 'For tests',
  fields: [
    { key: 'name', label: 'Name', type: 'text', mandatory: true },
    { key: 'hours', label: 'Hours', type: 'number', validation: { min: 0, max: 10 } },
  ],
  records: [
    { id: 'TES-001', name: 'Alpha', hours: 1 },
    { id: 'TES-002', name: 'Beta', hours: 2 },
  ],
} as MasterConfig;

describe('MasterDataImportModal', () => {
  it('can be opened after first rendering closed (hooks-order regression)', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = wrap(
      <MasterDataImportModal isOpen={false} onClose={() => {}} master={sampleMaster} onImportComplete={() => {}} />
    );
    expect(() =>
      rerender(
        <AppProvider>
          <MasterDataImportModal isOpen onClose={() => {}} master={sampleMaster} onImportComplete={() => {}} />
        </AppProvider>
      )
    ).not.toThrow();
    expect(screen.getAllByText(/Upload/i).length).toBeGreaterThan(0);
    errors.mockRestore();
  });
});

/** Holds the master in state like MastersMaintenancePage does. */
const EditorHarness: React.FC = () => {
  const [master, setMaster] = React.useState(sampleMaster);
  return (
    <>
      <MasterTableEditor master={master} isAdminTml onUpdateMaster={setMaster} />
      <output data-testid="ids">{master.records.map((r) => r.id).join(',')}</output>
    </>
  );
};

describe('MasterTableEditor', () => {
  it('adds a row with a fresh, unique id', async () => {
    const user = userEvent.setup();
    wrap(<EditorHarness />);
    await user.click(screen.getByRole('button', { name: /\+ Add Row/ }));
    await user.type(screen.getByPlaceholderText('Enter Name'), 'Gamma');
    await user.click(screen.getByRole('button', { name: 'Insert Row' }));
    const ids = screen.getByTestId('ids').textContent!.split(',');
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  it('rejects invalid numbers in the row form', async () => {
    const user = userEvent.setup();
    wrap(<EditorHarness />);
    await user.click(screen.getByRole('button', { name: /\+ Add Row/ }));
    await user.type(screen.getByPlaceholderText('Enter Name'), 'Gamma');
    const hours = screen.getByPlaceholderText(/numeric value/);
    await user.clear(hours);
    await user.type(hours, '99');
    await user.click(screen.getByRole('button', { name: 'Insert Row' }));
    expect(screen.getByTestId('ids').textContent!.split(',')).toHaveLength(2);
    expect(screen.getAllByText(/cannot be greater than 10/).length).toBeGreaterThan(0);
  });

  it('asks for confirmation before bulk deleting selected rows', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    wrap(<EditorHarness />);
    const rowCheckboxes = screen.getAllByRole('checkbox').filter((c) => c.closest('tbody'));
    await user.click(rowCheckboxes[0]);
    await user.click(screen.getByRole('button', { name: /Delete Selected/ }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByTestId('ids').textContent).toBe('TES-001,TES-002');

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: /Delete Selected/ }));
    expect(screen.getByTestId('ids').textContent).toBe('TES-002');
    confirm.mockRestore();
  });
});

describe('BulkEditModal', () => {
  it('validates values against the schema before applying', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <BulkEditModal isOpen onClose={() => {}} selectedRowIds={['TES-001']} master={sampleMaster} onApplyBulkEdit={onApply} />
    );
    const hoursRow = screen.getByText('Hours').closest('label')!.parentElement!.parentElement!;
    await user.click(within(hoursRow).getByRole('checkbox'));
    await user.type(within(hoursRow).getByRole('spinbutton'), '99');
    await user.click(screen.getByRole('button', { name: /Apply to 1 Rows/ }));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/cannot be greater than 10/);
  });
});

describe('RulesEngineStudio', () => {
  it('lets you type comma-separated dropdown options', async () => {
    const user = userEvent.setup();
    wrap(<RulesEngineStudio />);
    await user.click(screen.getByRole('button', { name: /New Rule|Add New|Create/i }));
    const widget = screen.getAllByRole('combobox').find((s) => within(s).queryByRole('option', { name: /select|dropdown/i }))!;
    await user.selectOptions(widget, 'select');
    const opts = screen.getByPlaceholderText(/PLATINUM, GOLD/);
    await user.type(opts, 'GOLD, SILVER');
    expect(opts).toHaveValue('GOLD, SILVER');
  });
});

describe('Pagination', () => {
  it('moves back into range when the list shrinks', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={5} totalItems={12} pageSize={10} onPageChange={onPageChange} />);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});

describe('AppContext actions', () => {
  let ctx: ReturnType<typeof useApp>;
  const Grab = () => {
    ctx = useApp();
    return null;
  };

  it('does not let an admin suspend their own account', () => {
    wrap(<Grab />);
    const me = ctx.currentUser.userId;
    act(() => ctx.suspendUser(me));
    expect(ctx.users.find((u) => u.userId === me)?.status).toBe('ACTIVE');
    expect(ctx.toast?.type).toBe('error');
  });

  it('writes exactly one audit entry per action', () => {
    wrap(<Grab />);
    const before = ctx.auditLogs.length;
    const target = ctx.users.find((u) => u.userId !== ctx.currentUser.userId && u.status === 'ACTIVE')!;
    act(() => ctx.suspendUser(target.userId));
    expect(ctx.auditLogs.length).toBe(before + 1);
    expect(ctx.users.find((u) => u.userId === target.userId)?.status).toBe('SUSPENDED');
  });

  it('terminate-all keeps the admin session and reports the right count', () => {
    wrap(<Grab />);
    const mine = ctx.currentUser.userId;
    const expected = ctx.sessions.filter((s) => (s.status === 'ACTIVE' || s.status === 'IDLE') && s.userId !== mine).length;
    act(() => ctx.terminateAllSessions());
    expect(ctx.toast?.message).toContain(`Terminated ${expected}`);
    expect(ctx.sessions.filter((s) => s.userId !== mine).every((s) => s.status === 'TERMINATED')).toBe(true);
  });

  it('logs a real before/after diff when configuration changes', () => {
    wrap(<Grab />);
    act(() => ctx.updateConfiguration({ ...ctx.configuration, maxLoginAttempts: ctx.configuration.maxLoginAttempts + 1 }));
    expect(ctx.auditLogs[0].newValue).toMatch(/maxLoginAttempts: \d+ → \d+/);
  });
});

describe('MastersMaintenancePage – bay management', () => {
  const openBays = async (user: ReturnType<typeof userEvent.setup>) => {
    render(
      <AppProvider>
        <BayProvider>
          <MastersMaintenancePage />
        </BayProvider>
      </AppProvider>
    );
    const dealerTab = screen.getAllByRole('button').find((b) => /Dealer Network/.test(b.textContent || ''))!;
    await user.click(dealerTab);
    const bayTab = screen.getAllByRole('button').find((b) => /^Bay Management/.test(b.textContent || ''))!;
    await user.click(bayTab);
  };

  it('a dealer bay within the TML allocation goes live immediately', async () => {
    const user = userEvent.setup();
    await openBays(user);
    await user.click(screen.getByRole('button', { name: 'Dealer Admin' }));
    await user.click(screen.getByRole('button', { name: /New Bay/ }));
    const form = screen.getByRole('form', { name: 'Add bay' });
    await user.type(within(form).getByLabelText(/Bay Name/), 'Mechanical Bay 03');
    expect(within(form).getByTestId('allocation-check')).toHaveTextContent('2 of 4 used');
    await user.click(within(form).getByRole('button', { name: 'Add Bay' }));
    const row = screen.getByText('Mechanical Bay 03').closest('tr')!;
    expect(row).toHaveTextContent('Active');
    expect(row).toHaveTextContent('Approved');
  });

  it('a dealer bay beyond the allocation needs a justification and is sent for approval with an email', async () => {
    const user = userEvent.setup();
    await openBays(user);
    await user.click(screen.getByRole('button', { name: 'Dealer Admin' }));
    await user.click(screen.getByRole('button', { name: /New Bay/ }));
    const form = screen.getByRole('form', { name: 'Add bay' });
    await user.type(within(form).getByLabelText(/Bay Name/), 'Electrical Bay 02');
    await user.selectOptions(within(form).getByLabelText('Bay Type'), 'Electrical');
    expect(within(form).getByTestId('allocation-check')).toHaveTextContent(/TML Network Manager/);
    await user.click(within(form).getByRole('button', { name: 'Send for Approval' }));
    expect(screen.getAllByText(/justification/i).length).toBeGreaterThan(0); // blocked without one
    await user.type(within(form).getByLabelText(/Justification/), 'New EV fleet contract');
    await user.click(within(form).getByRole('button', { name: 'Send for Approval' }));
    const email = await screen.findByTestId('email-preview');
    expect(email).toHaveTextContent('network.manager@tatamotors.com');
    expect(email).toHaveTextContent('#/admin/bay-approvals?request=');
  });

  it('dealer inactivation goes to TML Admin; TML Admin inactivation applies immediately', async () => {
    const user = userEvent.setup();
    await openBays(user);
    await user.click(screen.getByRole('button', { name: 'Dealer Admin' }));
    const bayRow = (id: string) => document.querySelector(`[data-bay-id="${id}"]`) as HTMLElement;
    let row = bayRow('BAY-01');
    await user.click(within(row).getByRole('button', { name: /Inactivate/ }));
    await user.selectOptions(screen.getByLabelText(/Reason/), 'Equipment breakdown');
    await user.click(screen.getByRole('button', { name: 'Send for Approval' }));
    expect(await screen.findByTestId('email-preview')).toHaveTextContent('tml.admin.support@tatamotors.com');
    await user.click(screen.getByRole('button', { name: /Done/ }));
    row = bayRow('BAY-01');
    expect(row).toHaveTextContent('Status change pending');

    await user.click(screen.getByRole('button', { name: 'TML Admin' }));
    row = bayRow('BAY-02');
    await user.click(within(row).getByRole('button', { name: /Inactivate/ }));
    await user.selectOptions(screen.getByLabelText(/Reason/), 'Preventive maintenance');
    await user.click(screen.getByRole('button', { name: 'Make Inactive' }));
    expect(bayRow('BAY-02')).toHaveTextContent('Inactive');
  });

  it('the dealer selector shows only that dealer\'s bays', async () => {
    const user = userEvent.setup();
    await openBays(user);
    await user.selectOptions(screen.getByLabelText('Dealer'), 'DLR1002');
    expect(screen.getByText(/Workshop Bays \(0\)/)).toBeInTheDocument();
  });
});
