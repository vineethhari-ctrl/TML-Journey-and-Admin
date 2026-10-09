/**
 * Bodyshop masters as CONFIRMED FINAL by the BA (Bodyshop_Master.xlsx, "Master List": both masters status Closed). Test data only.
 * The Inventory Capture Master sheet holds two tables side by side (sections: columns A-F; checkpoints: columns H-V); the BA
 * workbook spells "Sequence Prioirty" (kept in the source column name).
 */
export interface BodyshopField { name: string; type: string; values?: string[]; note?: string }
export interface BodyshopPart { master: string; part: string; fields: BodyshopField[]; rows: number }

const YN = ['Y', 'N'];

export const BODYSHOP_PARTS: BodyshopPart[] = [
  {
    master: 'Inventory Capture Master',
    part: 'Sections',
    rows: 14,
    fields: [
      { name: 'Section', type: 'Text', note: 'Documents, Accident Details, External, Internal, Inventory, Accessories, Tyre & Battery' },
      { name: 'Roles', type: 'Text (several, comma separated)', values: ['DSvAdv', 'Driver'], note: 'Written as "DSvAdv, Driver" in the file' },
      { name: 'Sequence Priority', type: 'Number', note: 'Source column is spelled "Sequence Prioirty"' },
      { name: 'Active', type: 'Yes / No', values: YN },
      { name: 'Service Type', type: 'Dropdown', values: ['All', 'Accident'] },
      { name: 'BU', type: 'Dropdown', values: ['PV', 'EV'], note: 'Every section appears twice, once for PV and once for EV' },
    ],
  },
  {
    master: 'Inventory Capture Master',
    part: 'Checkpoints',
    rows: 11,
    fields: [
      { name: 'Section', type: 'Text' },
      { name: 'Sub-Section Level 1', type: 'Text' },
      { name: 'Sub-Section Sequence', type: 'Number', note: 'Blank in some rows' },
      { name: 'Sub-Section Level 2', type: 'Text' },
      { name: 'Sub-Section Level 2 Sequence', type: 'Number' },
      { name: 'Checkpoint', type: 'Text' },
      { name: 'Checkpoint Sequence', type: 'Number' },
      { name: 'Role', type: 'Dropdown', values: ['DSvAdv', 'Driver'] },
      { name: 'Acceptable Values', type: 'Text (list)', values: ['OK', 'OK, NOT OK', 'OK, NOT OK, NA', 'Count'], note: 'Free text list in the file' },
      { name: 'Mandatory', type: 'Yes / No', values: YN },
      { name: 'Active', type: 'Yes / No', values: YN },
      { name: 'Video/Image', type: 'Dropdown', values: ['Image', 'Video', 'Video/Image'] },
      { name: 'No. of Image Required (Max 2)', type: 'Number', values: ['1', '2'] },
      { name: 'Image/Video Applicable On', type: 'Dropdown', values: ['All', 'Not OK'] },
      { name: 'Service Type', type: 'Dropdown', values: ['All', 'Accident'] },
    ],
  },
  {
    master: 'Insurance Document Collection - Customer',
    part: 'Documents',
    rows: 2,
    fields: [
      { name: 'Document Category', type: 'Text', note: 'Insurance Copy, Police Complaint Report' },
      { name: 'Mandatory Flag', type: 'Yes / No', values: YN },
      { name: 'Document Type', type: 'Dropdown', values: ['PDF/Image', 'Image'] },
      { name: 'No. of Image Required (Max 2)', type: 'Number', note: 'Blank for the PDF/Image row' },
      { name: 'Sequence', type: 'Number' },
      { name: 'Active', type: 'Yes / No', values: YN },
    ],
  },
];
