import { describe, it, expect } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

const goTo = async (route: string) => {
  await act(async () => {
    window.location.hash = route;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
};

describe('App routing', () => {
  it('starts on the dashboard and mirrors the route in the URL', () => {
    render(<App />);
    expect(window.location.hash).toBe('#/dashboard');
  });

  it('opens a deep link from the URL hash', async () => {
    window.location.hash = '#/journey/JC20260930001205';
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'GJ06FG1185' })).toBeInTheDocument();
    expect(screen.getByText(/of 12 stages completed/)).toBeInTheDocument();
  });

  it('shows "Job Card not found" for an unknown JC instead of another vehicle', async () => {
    render(<App />);
    await goTo('/journey/JC0000');
    expect(await screen.findByText('Job Card not found')).toBeInTheDocument();
  });

  it('applies ?search= to the Journey Search page', async () => {
    render(<App />);
    await goTo('/journey?search=KA03CD1074');
    const input = await screen.findByPlaceholderText(/Reg No, VIN, JC/);
    expect(input).toHaveValue('KA03CD1074');
    expect(screen.getAllByText('KA03CD1074').length).toBeGreaterThan(0);
  });

  it('blocks pages the active role cannot access and offers a permitted page', async () => {
    render(<App />);
    await userEvent.selectOptions(screen.getByDisplayValue('Super Administrator'), 'driver');
    await goTo('/admin/audit');
    expect(await screen.findByText('Access Restricted')).toBeInTheDocument();
    // Home (module cards) is open to every role, so it is the first permitted page offered
    expect(screen.getByRole('button', { name: /Go to Home/ })).toBeInTheDocument();
    // role choice survives a reload
    expect(localStorage.getItem('tml_active_role_v1')).toBe('driver');
  });
});

describe('Command palette', () => {
  it('opens with Ctrl+K and jumps straight to an exact JC with Enter', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Command palette' });
    await user.type(within(dialog).getByRole('textbox'), 'JC20260930001205');
    expect(within(dialog).getByText('Open journey JC20260930001205')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(window.location.hash).toBe('#/journey/JC20260930001205');
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument();
  });

  it('opens with "/" and lists only pages the role may open', async () => {
    const user = userEvent.setup();
    render(<App />);
    await userEvent.selectOptions(screen.getByDisplayValue('Super Administrator'), 'driver');
    await user.click(document.body);
    await user.keyboard('/');
    const dialog = await screen.findByRole('dialog', { name: 'Command palette' });
    expect(within(dialog).getByText('Journey Search')).toBeInTheDocument();
    expect(within(dialog).queryByText('Audit Log')).not.toBeInTheDocument();
  });

  it('supports arrow-key navigation', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Command palette' });
    const options = within(dialog).getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}');
    expect(within(dialog).getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
  });
});
