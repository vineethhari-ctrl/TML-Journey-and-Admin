import { describe, it, expect } from 'vitest';
import { buildIdChain, chainIds, validateIdChain, JcIdChain } from '../jcIdChain';
import { buildJourneyForCase, generateInitialData } from '../../data/mockDataGenerator';
import { journeyService, detectSearchType } from '../../services/journeyService';

const data = generateInitialData();
const stagesFor = (jc: string) =>
  jc === 'JC20260930001234' ? data.demoStages : buildJourneyForCase(data.serviceCases.find((c) => c.jcNumber === jc)!).stages;
const chainFor = (jc: string) => buildIdChain(data.serviceCases.find((c) => c.jcNumber === jc)!, stagesFor(jc));

describe('ID chain under a JC', () => {
  it('demo JC: Appointment → Visit → SR → Pre-JC → JC all created, in time order, with MRs and updates', () => {
    const chain = chainFor('JC20260930001234');
    expect(chain.arrival).toBe('Appointment');
    expect(chain.links.map((l) => [l.kind, l.status])).toEqual([
      ['APPOINTMENT', 'CREATED'],
      ['VISIT', 'CREATED'],
      ['SR', 'CREATED'],
      ['PRE_JC', 'CREATED'],
      ['JC', 'CREATED'],
    ]);
    expect(chain.links[0].id).toBe('APT-2026-99120'); // the Appointment stage reference
    expect(chain.links[4].id).toBe('JC20260930001234');
    expect(chain.mrs.length).toBeGreaterThan(0);
    expect(chain.updates.length).toBeGreaterThanOrEqual(4);
    expect(validateIdChain(chain)).toEqual([]);
  });

  it('is deterministic and consistent for every mock JC', () => {
    data.serviceCases.forEach((c) => {
      const a = chainFor(c.jcNumber);
      expect(a).toEqual(chainFor(c.jcNumber));
      expect(validateIdChain(a)).toEqual([]);
      if (a.links[4].status !== 'CREATED') expect(a.mrs).toEqual([]);
      // customer updates never carry the customer's name or number (DPDP)
      a.updates.forEach((u) => {
        expect(u.message).not.toContain(c.customerName);
        expect(u.message).not.toContain(c.customerMobile);
      });
    });
  });

  it('walk-ins have no Appointment ID; JCs before JC Creation have later links awaited', () => {
    const chains = data.serviceCases.map((c) => chainFor(c.jcNumber));
    const walkIn = chains.find((c) => c.arrival === 'Walk-In');
    expect(walkIn?.links[0]).toMatchObject({ status: 'NOT_APPLICABLE' });
    const early = data.serviceCases.find((c) => c.currentStage === 'Appointment');
    expect(early).toBeDefined();
    const ch = chainFor(early!.jcNumber);
    expect(ch.links.slice(1).map((l) => l.status)).toEqual(['AWAITED', 'AWAITED', 'AWAITED', 'AWAITED']);
    expect(ch.links[4].id).toBe(early!.jcNumber); // JC number reserved
    expect(chains.some((c) => c.srOrigin === 'Service Buddy (auto SR)')).toBe(true);
  });

  it('flags broken chains', () => {
    const good = chainFor('JC20260930001234');
    const broken: JcIdChain = {
      ...good,
      links: good.links.map((l) =>
        l.kind === 'VISIT' ? { ...l, status: 'AWAITED', id: undefined } : l.kind === 'SR' ? { ...l, createdAt: '2020-01-01 00:00' } : l,
      ),
      mrs: [...good.mrs, { ...good.mrs[0] }],
    };
    const issues = validateIdChain(broken);
    expect(issues).toContain('SR ID exists but Visit ID is still awaited.');
    expect(issues).toContain('SR ID is time-stamped before Appointment ID.');
    expect(issues).toContain(`${good.mrs[0].id} appears twice in the chain.`);
    const noJc: JcIdChain = { ...good, links: good.links.map((l) => (l.kind === 'JC' ? { ...l, status: 'AWAITED' } : l)) };
    expect(validateIdChain(noJc)).toContain('MR raised before the JC was opened.');
  });
});

describe('Journey Search finds a JC by any ID in its chain', () => {
  const chain = chainFor('JC20260930001234');
  const linkedIdsByJc = Object.fromEntries(data.serviceCases.map((c) => [c.jcNumber, chainIds(chainFor(c.jcNumber))]));

  it('detects linked IDs', () => {
    expect(detectSearchType(chain.links[2].id!)).toBe('linked');
    expect(detectSearchType(chain.mrs[0].id!.toLowerCase())).toBe('linked');
    expect(detectSearchType('APT-2026-99120')).toBe('linked');
  });

  it.each(['SR', 'PRE_JC', 'VISIT'])('%s ID → the demo JC', (kind) => {
    const id = chain.links.find((l) => l.kind === kind)!.id!;
    for (const searchBy of ['auto', 'linked'] as const) {
      const res = journeyService.filterServiceCases(data.serviceCases, { query: id, searchBy, linkedIdsByJc });
      expect(res.map((c) => c.jcNumber)).toEqual(['JC20260930001234']);
    }
  });

  it('MR ID → its JC', () => {
    const res = journeyService.filterServiceCases(data.serviceCases, { query: chain.mrs[0].id!, linkedIdsByJc });
    expect(res.map((c) => c.jcNumber)).toContain('JC20260930001234');
  });
});
