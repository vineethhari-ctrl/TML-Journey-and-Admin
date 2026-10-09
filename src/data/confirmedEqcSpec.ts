/**
 * eQC masters as CONFIRMED FINAL by the BA ("eQC Master Management Portal v11", 9 Oct 2026). Test data only.
 * Transcribed as data from the BA's HTML (META, SEED, PPL_LOV); the HTML itself is never run.
 * field = [name, type, options-or-fixed-value]; types: text, number, bool (yes/no), date, select, ppl (pick from the PPL list), fixed.
 */
export type EqcFieldDef = [string, 'text' | 'number' | 'bool' | 'date' | 'select' | 'ppl' | 'fixed', (string[] | string)?];
export interface EqcMasterSpec { name: string; keys: string[]; fields: EqcFieldDef[] }
export const EQC_SPEC: Record<string, EqcMasterSpec> = {
 "general": {
  "name": "General Checklist",
  "keys": [
   "BU",
   "Checklist Item",
   "All KM Ranges",
   "Range Start KM",
   "Range End KM",
   "All PPLs",
   "PPL"
  ],
  "fields": [
   [
    "BU",
    "select",
    [
     "PV",
     "EV"
    ]
   ],
   [
    "Checklist Type",
    "fixed",
    "General Checks"
   ],
   [
    "Checklist Item",
    "text"
   ],
   [
    "All KM Ranges",
    "bool"
   ],
   [
    "Range Start KM",
    "number"
   ],
   [
    "Range End KM",
    "number"
   ],
   [
    "All PPLs",
    "bool"
   ],
   [
    "PPL",
    "ppl"
   ],
   [
    "Conditional Not OK",
    "bool"
   ],
   [
    "Photo",
    "bool"
   ],
   [
    "Audio",
    "bool"
   ],
   [
    "Video",
    "bool"
   ],
   [
    "Text",
    "bool"
   ],
   [
    "Display Priority",
    "number"
   ],
   [
    "Active",
    "bool"
   ]
  ]
 },
 "scheduled": {
  "name": "Scheduled Checklist",
  "keys": [
   "BU",
   "Section",
   "Sub-Section",
   "All KM Ranges",
   "Range Start KM",
   "Range End KM",
   "All PPLs",
   "PPL"
  ],
  "fields": [
   [
    "BU",
    "select",
    [
     "PV",
     "EV"
    ]
   ],
   [
    "Checklist Type",
    "fixed",
    "Scheduled Checks"
   ],
   [
    "Section",
    "text"
   ],
   [
    "Section Priority",
    "number"
   ],
   [
    "Sub-Section",
    "text"
   ],
   [
    "Sub-Section Priority",
    "number"
   ],
   [
    "All KM Ranges",
    "bool"
   ],
   [
    "Range Start KM",
    "number"
   ],
   [
    "Range End KM",
    "number"
   ],
   [
    "All PPLs",
    "bool"
   ],
   [
    "PPL",
    "ppl"
   ],
   [
    "Conditional Not OK",
    "bool"
   ],
   [
    "Photo",
    "bool"
   ],
   [
    "Audio",
    "bool"
   ],
   [
    "Video",
    "bool"
   ],
   [
    "Text",
    "bool"
   ],
   [
    "Active",
    "bool"
   ]
  ]
 },
 "bodyshop": {
  "name": "Bodyshop Checklist",
  "keys": [
   "Section",
   "Sub-Section",
   "All PPLs",
   "PPL"
  ],
  "fields": [
   [
    "Section",
    "text"
   ],
   [
    "Sub-Section",
    "text"
   ],
   [
    "All PPLs",
    "bool"
   ],
   [
    "PPL",
    "ppl"
   ],
   [
    "Conditional Not OK",
    "bool"
   ],
   [
    "Photo",
    "bool"
   ],
   [
    "Audio",
    "bool"
   ],
   [
    "Video",
    "bool"
   ],
   [
    "Text",
    "bool"
   ],
   [
    "Display Priority",
    "number"
   ],
   [
    "Active",
    "bool"
   ]
  ]
 },
 "washing": {
  "name": "Washing Checklist",
  "keys": [
   "Section",
   "Check Description"
  ],
  "fields": [
   [
    "Section",
    "text"
   ],
   [
    "Check Description",
    "text"
   ],
   [
    "Minimum Photo Count",
    "number"
   ],
   [
    "Maximum Photo Count",
    "number"
   ],
   [
    "Image Angle Code",
    "text"
   ],
   [
    "AI Validation Enabled",
    "bool"
   ],
   [
    "Display Priority",
    "number"
   ],
   [
    "Active",
    "bool"
   ]
  ]
 },
 "washingJob": {
  "name": "Washing Job Code Master",
  "keys": [
   "Job Code Category",
   "Job Code Value"
  ],
  "fields": [
   [
    "Job Code Category",
    "select",
    [
     "SSC",
     "WASHING",
     "SPEEDO"
    ]
   ],
   [
    "Job Code Value",
    "text"
   ],
   [
    "Scheduled Checklist Applicable",
    "bool"
   ],
   [
    "Washing Applicable",
    "bool"
   ],
   [
    "Speedometer Capture Applicable",
    "bool"
   ],
   [
    "Effective From",
    "date"
   ],
   [
    "Effective To",
    "date"
   ],
   [
    "Active",
    "bool"
   ]
  ]
 },
 "guided": {
  "name": "Guided Check & Road Test",
  "keys": [
   "PPL",
   "Complaint Code"
  ],
  "fields": [
   [
    "PPL",
    "ppl"
   ],
   [
    "Complaint Code",
    "text"
   ],
   [
    "Guided Check Applicable",
    "bool"
   ],
   [
    "Guided Check Mandatory",
    "bool"
   ],
   [
    "Guided Check Mandatory Till",
    "date"
   ],
   [
    "Road Test Mandatory",
    "bool"
   ],
   [
    "Guided Steps",
    "text"
   ],
   [
    "Active",
    "bool"
   ]
  ]
 },
 "exception": {
  "name": "VCI / OBD Exceptions",
  "keys": [
   "VC Number",
   "Exception Type"
  ],
  "fields": [
   [
    "VC Number",
    "text"
   ],
   [
    "Exception Type",
    "select",
    [
     "VCI",
     "OBD",
     "Both"
    ]
   ],
   [
    "Exception Reason",
    "text"
   ],
   [
    "Effective From",
    "date"
   ],
   [
    "Exception Till",
    "date"
   ],
   [
    "Approved By",
    "text"
   ],
   [
    "Active",
    "bool"
   ]
  ]
 },
 "did": {
  "name": "DID Threshold Mapping",
  "keys": [
   "Parameter Name",
   "Rule Type",
   "All PPLs",
   "PPL",
   "Fuel Type",
   "VC Applicability"
  ],
  "fields": [
   [
    "Parameter Name",
    "text"
   ],
   [
    "Unit",
    "text"
   ],
   [
    "Rule Type",
    "select",
    [
     "Exact Value",
     "Minimum / Maximum Range",
     "Greater Than",
     "Less Than",
     "Allowed Value List"
    ]
   ],
   [
    "Expected Value / Range",
    "text"
   ],
   [
    "All PPLs",
    "bool"
   ],
   [
    "PPL",
    "ppl"
   ],
   [
    "Fuel Type",
    "text"
   ],
   [
    "VC Applicability",
    "text"
   ],
   [
    "Effective From",
    "date"
   ],
   [
    "Effective To",
    "date"
   ],
   [
    "Active",
    "bool"
   ]
  ]
 },
 "ptd": {
  "name": "PTD Risk Configuration",
  "keys": [
   "Color Code",
   "BU / Service Type"
  ],
  "fields": [
   [
    "Color Code",
    "select",
    [
     "Green",
     "Orange",
     "Red",
     "Breached"
    ]
   ],
   [
    "Threshold Hours",
    "number"
   ],
   [
    "Threshold Minutes",
    "number"
   ],
   [
    "BU / Service Type",
    "text"
   ],
   [
    "Active",
    "bool"
   ]
  ]
 }
};
export const EQC_SAMPLE: Record<string, Array<Record<string, string | number | boolean>>> = {
 "general": [
  {
   "id": "GEN-001",
   "BU": "PV",
   "Checklist Type": "General Checks",
   "Checklist Item": "Instrument cluster warning lights checked",
   "All KM Ranges": false,
   "Range Start KM": 10000,
   "Range End KM": 20000,
   "All PPLs": false,
   "PPL": "Nexon",
   "Conditional Not OK": true,
   "Photo": true,
   "Audio": false,
   "Video": false,
   "Text": true,
   "Display Priority": 1,
   "Active": true
  }
 ],
 "scheduled": [
  {
   "id": "SCH-001",
   "BU": "PV",
   "Checklist Type": "Scheduled Checks",
   "Section": "Engine and Fluids",
   "Section Priority": 1,
   "Sub-Section": "Engine Oil Level",
   "Sub-Section Priority": 1,
   "All KM Ranges": true,
   "Range Start KM": "",
   "Range End KM": "",
   "All PPLs": false,
   "PPL": "Nexon",
   "Conditional Not OK": true,
   "Photo": true,
   "Audio": false,
   "Video": false,
   "Text": true,
   "Active": true
  }
 ],
 "bodyshop": [
  {
   "id": "BOD-001",
   "Section": "Exterior Finish",
   "Sub-Section": "Panel gap and alignment",
   "All PPLs": true,
   "PPL": "",
   "Conditional Not OK": true,
   "Photo": true,
   "Audio": false,
   "Video": false,
   "Text": true,
   "Display Priority": 1,
   "Active": true
  }
 ],
 "washing": [
  {
   "id": "WAS-001",
   "Section": "Washing Checks",
   "Check Description": "Front view: bumper, grille, headlamps and windshield",
   "Minimum Photo Count": 1,
   "Maximum Photo Count": 2,
   "Image Angle Code": "FRONT",
   "AI Validation Enabled": false,
   "Display Priority": 1,
   "Active": true
  }
 ],
 "washingJob": [
  {
   "id": "JOB-001",
   "Job Code Category": "SSC",
   "Job Code Value": "FREE1",
   "Scheduled Checklist Applicable": true,
   "Washing Applicable": false,
   "Speedometer Capture Applicable": false,
   "Effective From": "2026-01-01",
   "Effective To": "",
   "Active": true
  }
 ],
 "guided": [
  {
   "id": "GUI-001",
   "PPL": "Nexon",
   "Complaint Code": "CC_01",
   "Guided Check Applicable": true,
   "Guided Check Mandatory": true,
   "Guided Check Mandatory Till": "2026-12-31",
   "Road Test Mandatory": true,
   "Guided Steps": "Verify concern; Visual inspection; VCI/DTC check",
   "Active": true
  }
 ],
 "exception": [
  {
   "id": "EXC-001",
   "VC Number": "VC-1",
   "Exception Type": "Both",
   "Exception Reason": "Temporary compatibility exception",
   "Effective From": "2026-01-01",
   "Exception Till": "2026-12-31",
   "Approved By": "Business Admin",
   "Active": true
  }
 ],
 "did": [
  {
   "id": "DID-001",
   "Parameter Name": "HV Battery SOC",
   "Unit": "%",
   "Rule Type": "Minimum / Maximum Range",
   "Expected Value / Range": "20-100",
   "All PPLs": false,
   "PPL": "Nexon EV",
   "Fuel Type": "EV",
   "VC Applicability": "All",
   "Effective From": "2026-01-01",
   "Effective To": "",
   "Active": true
  }
 ],
 "ptd": [
  {
   "id": "PTD-001",
   "Color Code": "Orange",
   "Threshold Hours": 3,
   "Threshold Minutes": 0,
   "BU / Service Type": "All",
   "Active": true
  },
  {
   "id": "PTD-002",
   "Color Code": "Red",
   "Threshold Hours": 0,
   "Threshold Minutes": 30,
   "BU / Service Type": "All",
   "Active": true
  }
 ]
};
export const EQC_PPL_LIST: string[] = ["Altroz","Curvv","Curvv EV","Harrier","Nexon","Nexon CNG","Nexon EV","Punch","Punch EV","Safari","Tiago","Tiago EV","Tigor","Tigor EV"];
