// src/constants/productionStatuses.js

// These exact strings must match what’s stored in Firestore.
// For example, if your Firestore document shows: Status: "In Production",
// then IN_PRODUCTION must be exactly "In Production" (including capitalization).

export const STATUSES = {
  PENDING:          'Pending',
  IN_PRODUCTION:    'In Production',
  IN_CUTTING:       'In Cutting',
  IN_STITCHING:     'In Stitching',
  QC:               'QC',
  QC_RECONTROL_1:   'QC-Recontrol 1',
  QC_RECONTROL_2:   'QC-Recontrol 2',
  PACKING:          'packing',
  DELIVERED:        'Delivered'
};

// Define for each status which statuses can come next.
// (Adjust this mapping if your workflow differs.)
export const NEXT_STATUS = {
  [STATUSES.PENDING]:        [STATUSES.IN_PRODUCTION],
  [STATUSES.IN_PRODUCTION]:  [STATUSES.IN_CUTTING],
  [STATUSES.IN_CUTTING]:     [STATUSES.IN_STITCHING],
  [STATUSES.IN_STITCHING]:   [STATUSES.QC],
  [STATUSES.QC]:             [STATUSES.QC_RECONTROL_1, STATUSES.PACKING],
  [STATUSES.QC_RECONTROL_1]: [STATUSES.QC_RECONTROL_2, STATUSES.PACKING],
  [STATUSES.QC_RECONTROL_2]: [STATUSES.PACKING],
  [STATUSES.PACKING]:        [STATUSES.DELIVERED],
  [STATUSES.DELIVERED]:      []
};
