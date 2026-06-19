'use strict';

const CUSTOMER_ACK_OPTIONS = ['', 'Customer Acknowledges', 'N/A'];

/* Text blocks displayed on the form for selected checklist options */
const DISPLAYED_WORDING = {
  irrigationLines: [['Customer Acknowledges', "Customer understands and acknowledges that Absolute Aluminum will not handle anything to do with sprinklers/lines etc. and that it is the customer's responsibility."]],
  bushes: [['Customer Acknowledges', 'Customer understands and acknowledges their responsibility to ensure the work area is prepared and cleared of vegetation prior to our arrival. A minimum of 2 feet of clearance is required around the work area. Vegetation taller than 3 feet must be trimmed down to allow safe ladder placement and access.']],
  equipment: [['Customer Acknowledges', 'Customer understands and acknowledges that Absolute Aluminum is not responsible for any damage to landscaping, sod, sprinklers, yard ruts etc. in work area. In some instances, we will hold off on your project during the rainy season to avoid severe damage to your yard. Re-sodding around foundation work is not included.']],
  drawPayment: [['Customer Acknowledges', 'Customer has received, understands and acknowledges the draw schedule and will submit payments accordingly.']],
  tearoutTarping: [['Customer Acknowledges', 'Customer understands and acknowledges that the pool cannot be tarped as this is a life safety issue.']],
  tearoutCleanup: [['Customer Acknowledges', 'Customer understands and acknowledges our process is to cut back and clean up old caulking as best we can as well as fill old holes. This does not include painting or stucco repair.']],
  superGutterTearout: [
    ['By Others', 'To be torn out by someone else.'],
    ['By AA + Release Required', 'To be torn out by Absolute Aluminum and Customer will sign Release of Liability.']
  ],
  survey: [
    ['Customer to Provide', 'Customer will provide the boundary survey required for this project as contracted.'],
    ['AA to Provide', 'Absolute Aluminum will provide the boundary survey required for this project as required.']
  ],
  woodRotWoodRepairs: [['Customer Acknowledges', 'Customer understands and acknowledges that if any wood rot is found during construction they will be informed and will be responsible for any repair. Absolute Aluminum does not repair any wood nor is there any wood repair of any kind in this contract.']],
  clauseOnContract: [['Customer Acknowledges', 'Customer understands and acknowledges all clauses in contract that are applicable.']],
  measure: [['Customer Acknowledges', 'Customer has received, understands and acknowledges the scheduling dates via email. Customer is aware that any changes to the schedule will be sent via email/text and reflect updated dates.']],
  construction: [['Customer Acknowledges', 'Customer has received, understands and acknowledges the scheduling dates via email. Customer is aware that any changes to the schedule will be sent via email/text and reflect updated dates.']],
  installShavings: [['Customer Acknowledges', 'Customer understands and acknowledges that shavings are possible.']],
  qualityControl: [['Customer Acknowledges', 'Customer understands and acknowledges.']],
  finalPayment: [['Customer Acknowledges', 'Customer understands and acknowledges that the final payment is due upon substantial completion and not the final inspections if applicable.']],
  guildQuality: [['Customer Acknowledges', 'Customer understands and acknowledges.']],
  undergroundDrainClause: [['Customer Acknowledges + Release', 'Customer understands and acknowledges. Customer will sign Release of Liability.']],
  expectations: [['Customer Acknowledges', 'Customer understands and acknowledges that no expectations have been set that are not expressly written in this contract.']]
};

/* Fields captured for each job checklist */
const ADDRESS_FIELDS = [
  { id: 'streetAddress', label: 'Street Address', type: 'text', autocomplete: 'address-line1', fullWidth: true },
  { id: 'city', label: 'City', type: 'text', autocomplete: 'address-level2' },
  { id: 'state', label: 'State', type: 'text', autocomplete: 'address-level1', maxLength: 2, placeholder: 'FL' },
  { id: 'zip', label: 'ZIP Code', type: 'text', autocomplete: 'postal-code', inputMode: 'numeric', maxLength: 10, placeholder: '12345' }
];

const JOB_FIELDS = [
  { id: 'customerName', label: 'Customer Name', type: 'text' },
  ...ADDRESS_FIELDS,
  { id: 'email', label: 'Email', type: 'email' },
  { id: 'phone', label: 'Phone #', type: 'tel' },
  { id: 'jobNumberPhase', label: 'Job # and Phase', type: 'text' },
  { id: 'gateCode', label: 'Gate Code', type: 'text' },
  { id: 'preconSpecialist', label: 'Pre-Construction Specialist', type: 'text' }
];

const INSPECTION_ITEMS = [
  { id: 'irrigationLines', label: 'Irrigation Lines', options: CUSTOMER_ACK_OPTIONS },
  { id: 'bushes', label: 'Bushes', options: CUSTOMER_ACK_OPTIONS },
  { id: 'equipment', label: 'Equipment', options: CUSTOMER_ACK_OPTIONS },
  { id: 'sitePrep', label: 'Site Prep', input: 'text' },
  { id: 'drawPayment', label: 'Draw payment', options: CUSTOMER_ACK_OPTIONS },
  { id: 'tearoutTarping', label: 'Tearout (tarping of the pool)', options: CUSTOMER_ACK_OPTIONS },
  { id: 'tearoutCleanup', label: 'Tearout (Clean up & fill holes)', options: CUSTOMER_ACK_OPTIONS },
  { id: 'superGutterTearout', label: 'Super Gutter Tearout', options: ['', 'By Others', 'By AA + Release Required', 'N/A'] },
  { id: 'houseGutterTearout', label: 'House Gutter Tearout', input: 'text' },
  { id: 'survey', label: 'Survey', options: ['', 'Customer to Provide', 'AA to Provide', 'N/A'] },
  { id: 'paversTravertine', label: 'Pavers/Travertine', input: 'text' },
  { id: 'woodRotWoodRepairs', label: 'Wood Rot/Wood Repairs', options: CUSTOMER_ACK_OPTIONS },
  { id: 'fanBeams', label: 'Fan Beams', input: 'text' },
  { id: 'fanSize', label: 'Fan Size', input: 'text' },
  { id: 'electric', label: 'Electric', input: 'text' },
  { id: 'ezCleans', label: 'EZ Cleans', options: ['', 'Entire Perimeter', 'Front Wall Only', 'None', 'N/A'] },
  { id: 'armourPlate', label: 'Armour Plate', options: ['', 'Entire Bottom Perimeter', 'Front Wall Bottom Only', 'New 1x2 Bottom Only', 'None', 'N/A'] },
  { id: 'rollDownScreens', label: 'Roll Down Screens', input: 'text' },
  { id: 'screenType', label: 'Screen Type', options: ['', 'No-Seeum Phifer Tuff', 'Phifer Tuff', 'Premium 18-14', 'Premium 20-20', 'Economy 18-14', 'Economy 20-20', 'N/A'] },
  { id: 'totalScreenSqft', label: 'Total Screen Square Footage', input: 'text' },
  { id: 'colorSelections', label: 'Color Selections', options: ['', 'Bronze', 'White', 'N/A'] },
  { id: 'fastenerType', label: 'Fastener Type', options: ['', 'Pro-Tec 304 SS', 'Ultra Coat 410 SS', '316 SS + Pro-Tec', 'N/A'] },
  { id: 'downspoutsDischarges', label: 'Downspouts/Discharges', input: 'text' },
  { id: 'doorLocationsSwing', label: 'Door Locations/Swing (Threshold)', input: 'text' },
  { id: 'doorHandleHeight', label: 'Door Handle Height', options: ['', '36"', '54"', 'N/A'] },
  { id: 'clauseOnContract', label: 'Clause on Contract', options: CUSTOMER_ACK_OPTIONS },
  { id: 'measure', label: 'Measure', options: CUSTOMER_ACK_OPTIONS },
  { id: 'communicationPreference', label: 'Communication Preference', options: ['', 'Email', 'Text', 'Call', 'N/A'] },
  { id: 'construction', label: 'Construction', options: CUSTOMER_ACK_OPTIONS },
  { id: 'installShavings', label: 'Install/Possible Shavings', options: CUSTOMER_ACK_OPTIONS },
  { id: 'warrantyInformation', label: 'Warranty Information', options: ['', '5 Year Abso-Shield', 'N/A'] },
  { id: 'tuffScreenWarranty', label: 'Tuff Screen Warranty', options: ['', '10 Year Manufacturers Warranty', 'N/A'] },
  { id: 'qualityControl', label: 'Quality Control/Inspections/Permits', options: CUSTOMER_ACK_OPTIONS },
  { id: 'finalPayment', label: 'Final Payment', options: CUSTOMER_ACK_OPTIONS },
  { id: 'guildQuality', label: 'Guild Quality', options: CUSTOMER_ACK_OPTIONS },
  { id: 'checkForFlashing', label: 'Check For Flashing', input: 'text' },
  { id: 'hoa', label: 'HOA', options: ['', 'Approved', 'Needs Approval', 'N/A'] },
  { id: 'cageRoofStyle', label: 'Cage Roof Style', options: ['', 'Mansard', 'Hip', 'A-Frame', 'Gable', 'Half Mansard', 'Flat', 'Shed', 'Custom', 'N/A'] },
  { id: 'wallOptions', label: 'Wall Options', options: ['', 'Standard with Posts', 'Front Wall Only Absoview', 'Full Absoview', 'N/A'] },
  { id: 'chairRailHeight', label: 'Chair Rail Height', options: ['', '16"', '24"', '30"', '36"', '40"', '48"', 'N/A'] },
  { id: 'nebula', label: 'Nebula', options: ['', 'Colored LEDs', 'White LEDs', 'N/A'] },
  { id: 'pergola', label: 'Pergola', input: 'text' },
  { id: 'dogDoor', label: 'Dog Door', options: ['', 'S', 'M', 'L', 'XL', 'N/A'] },
  { id: 'passThruDoors', label: 'Pass Thru Doors', options: ['', '1', '2', 'N/A'] },
  { id: 'undergroundDrainClause', label: 'Underground Drain Clause', options: ['', 'Customer Acknowledges + Release', 'N/A'] },
  { id: 'expectations', label: 'Expectations', options: CUSTOMER_ACK_OPTIONS }
];

/* In-house checklist items for internal notes and measurements */
const IN_HOUSE_ITEMS = [
  { id: 'limitedWorkArea', label: 'Limited Work Area', input: 'text' },
  { id: 'gutterEndCaps', label: 'Gutter End Caps', input: 'text' },
  { id: 'plumbAngledFascia', label: 'Plumb or Angled Fascia', options: ['', 'Plumb', 'Angled', 'N/A'] },
  { id: 'freezeBoard', label: 'Freeze Board', input: 'text' },
  { id: 'postReplacement', label: 'Post Replacement', input: 'text' },
  { id: 'eveHeightCageHeight', label: 'Eve Height/Cage Height', input: 'text' },
  { id: 'doorPads', label: 'Door Pad(s)', input: 'text' },
  { id: 'existingBoxMiter', label: 'Existing Box Miter', input: 'text' },
  { id: 'overhangDimensions', label: 'Overhang Dimensions', input: 'text' },
  { id: 'stepUpDimensions', label: 'Step-Up Dimensions', input: 'text' },
  { id: 'bayWindowMeasurements', label: 'Bay Window Measurements', input: 'text' },
  { id: 'noc', label: 'NOC', options: ['', 'Needs Signature/Submittal', 'Signed and Submitted', 'N/A'] }
];

const QC_JOB_FIELDS = [
  { id: 'customerName', label: 'Customer Name', type: 'text' },
  ...ADDRESS_FIELDS,
  { id: 'jobNumberPhase', label: 'Job # and Phase', type: 'text' },
  { id: 'qualityControlDate', label: 'Quality Control Date', type: 'date' },
  { id: 'qualityControlInspector', label: 'Quality Control Inspector', type: 'text' },
  { id: 'crewLead', label: 'Crew Lead', type: 'text' },
  { id: 'projectType', label: 'Project Type', type: 'text' },
  { id: 'permitNumber', label: 'Permit #', type: 'text' }
];

const QC_INSPECTION_ITEMS = [
  { id: 'superGutterSeamsFastened', label: 'Super Gutter seams fastened tight', options: ['', 'Yes', 'No'] },
  { id: 'doorsOperationalAndLock', label: 'Doors are operational and lock', options: ['', 'Yes', 'No'] },
  { id: 'doorKeepersRemovedExplained', label: 'Door keepers removed and explained to customers', options: ['', 'Yes', 'No'] },
  { id: 'bugSweepsNoGaps', label: 'Bug sweeps installed with no gaps', options: ['', 'Yes', 'No'] },
  { id: 'weepHoleAtBeamCaps', label: 'Weep hole at beam caps', options: ['', 'Yes', 'No'] },
  { id: 'screwProtecCapsComplete', label: 'Screw/Protec caps fasteners are complete', options: ['', 'Yes', 'No'] },
  { id: 'caulkingInsideOutside', label: 'Caulking is applied inside and outside', options: ['', 'Yes', 'No'] },
  { id: 'ezCleansProperlyInstalled', label: 'EZ Cleans are properly installed', options: ['', 'Yes', 'No'] },
  { id: 'openAreasGapsAddressed', label: 'Open area or gaps have been addressed', options: ['', 'Yes', 'No'] },
  { id: 'beamCapsInstalledProperly', label: 'Beam caps installed properly', options: ['', 'Yes', 'No'] },
  { id: 'screenFreeOfDefects', label: 'Screen is free of defects, wrinkles, and bubbles', options: ['', 'Yes', 'No'] },
  { id: 'cableNutsTightNoPaverRub', label: 'Cable is and cable nuts are tight and not rubbing on pavers', options: ['', 'Yes', 'No'] },
  { id: 'groundWireAttached', label: 'Ground wire is attached from cage to pump', options: ['', 'Yes', 'No'] },
  { id: 'retractableScreensOperational', label: 'Retractable screens are operational', options: ['', 'Yes', 'No'] }
];

const QC_GUTTER_ITEMS = [
  { id: 'downspoutsProperLocation', label: 'Downspouts installed in proper location', options: ['', 'Yes', 'No'] },
  { id: 'downspoutElbowsExtensionsInstalled', label: 'Downspouts ground level elbow with extensions are installed', options: ['', 'Yes', 'No'] },
  { id: 'divertersInstalled', label: 'Diverters Installed', options: ['', 'Yes', 'No'] },
  { id: 'leafGuardInstalled', label: 'Leaf Guard system installed', options: ['', 'Yes', 'No'] },
  { id: 'superGutterSeamsLeakFree', label: 'Super gutter seams are fastened tight and leak free', options: ['', 'Yes', 'No'] },
  { id: 'hiddenHangersSealed', label: 'Hidden hangers are properly sealed', options: ['', 'Yes', 'No'] }
];
const QC_PERGOLA_PAN6_ITEMS = [
  { id: 'louversOperational', label: 'Louvers are operational', options: ['', 'Yes', 'No'] },
  { id: 'fansLightsOperational', label: 'Fans/lights are operational', options: ['', 'Yes', 'No'] },
  { id: 'materialScratchDentFree', label: 'Material is scratch & dent free', options: ['', 'Yes', 'No'] },
  { id: 'superGutterSeamsNeatLeakFree', label: 'Super gutter seams are fastened neat and leak free', options: ['', 'Yes', 'No'] },
  { id: 'doorsOperationalAndLockPergola', label: 'Doors are operational and lock', options: ['', 'Yes', 'No'] },
  { id: 'doorKeepersRemovedExplainedPergola', label: 'Door keepers removed and explained to customers', options: ['', 'Yes', 'No'] },
  { id: 'bugSweepsNoGapsPergola', label: 'Bug sweeps installed with no gaps', options: ['', 'Yes', 'No'] },
  { id: 'weepHoleAtBeamCapsPergola', label: 'Weep hole at beam caps', options: ['', 'Yes', 'No'] },
  { id: 'screwProtecCapsCompletePergola', label: 'Screw/Protec caps fasteners are complete', options: ['', 'Yes', 'No'] },
  { id: 'caulkingInsideOutsidePergola', label: 'Caulking is applied inside and outside', options: ['', 'Yes', 'No'] },
  { id: 'ezCleansProperlyInstalledPergola', label: 'EZ cleans are properly installed', options: ['', 'Yes', 'No'] },
  { id: 'openAreasGapsAddressedPergola', label: 'Open areas or gaps have been addressed', options: ['', 'Yes', 'No'] },
  { id: 'screenFreeOfDefectsPergola', label: 'Screen is free of defects, wrinkles & bubbles', options: ['', 'Yes', 'No'] },
  { id: 'retractableScreensOperationalPergola', label: 'Retractable screens are operational', options: ['', 'Yes', 'No'] }
];

const QC_GENERAL_ITEMS = [
  { id: 'jobSiteClean', label: 'Job Site Clean', options: ['', 'Yes', 'No'] },
  { id: 'completionPerContract', label: 'Completion of Job per Contract', options: ['', 'Yes', 'No'] },
  { id: 'permitPosted', label: 'Permit Posted', options: ['', 'Yes', 'No'] },
  { id: 'overallSatisfaction', label: 'Overall Satisfaction', options: ['', 'Yes', 'No'] },
  { id: 'surveys', label: 'Surveys', options: ['', 'Yes', 'No'] },
  { id: 'paymentCollected', label: 'Payment Collected', options: ['', 'Yes', 'No'] },
  { id: 'tervisTumblers', label: 'Tervis Tumblers', options: ['', 'Yes', 'No'] }
];

const QC_CORRECTIVE_ITEMS = [
  { id: 'openItems', label: 'Open Correction Items', input: 'text' },
  { id: 'assignedTo', label: 'Assigned To', input: 'text' },
  { id: 'targetCompletionDate', label: 'Target Completion Date', input: 'text' },
  { id: 'followUpRequired', label: 'Follow-Up Required', options: ['', 'Yes', 'No'] },
  { id: 'finalQcStatus', label: 'Final QC Status', options: ['', 'Passed', 'Passed With Corrections', 'Failed / Needs Return Visit'] }
];

const DOCUMENT_TYPES = {
  precon: {
    id: 'precon',
    label: 'Pre-Construction Checklist',
    shortLabel: 'Pre-Con',
    title: 'Pre-Construction Checklist',
    pdfTitle: 'PRE-CONSTRUCTION CHECKLIST',
    filenameLabel: 'Precon',
    defaultFilename: 'PreCon',
    summaryPlaceholder: 'Enter pre-construction summary notes...',
    signatureText: 'By signing below, customer acknowledges the Pre-Construction Checklist and all included selections, notes, and attachments.',
    fields: JOB_FIELDS,
    displayedWording: DISPLAYED_WORDING,
    groups: [
      { key: 'items', title: 'Inspection Items', pdfTitle: 'INSPECTION ITEMS', continuedTitle: 'Inspection Items continued', items: INSPECTION_ITEMS },
      { key: 'inHouse', title: 'In-House Use', pdfTitle: 'IN-HOUSE USE', continuedTitle: 'In-House Use continued', items: IN_HOUSE_ITEMS }
    ]
  },
  qualityControl: {
    id: 'qualityControl',
    label: 'Quality Control Document',
    shortLabel: 'Quality Control',
    title: 'Quality Control Document',
    pdfTitle: 'ZERO DEFECT REPORT',
    filenameLabel: 'QC',
    defaultFilename: 'QualityControl',
    summaryPlaceholder: 'Enter quality control summary notes...',
    signatureText: 'By signing below, customer acknowledges the Quality Control document and all included observations, correction items, notes, and attachments.',
    fields: QC_JOB_FIELDS,
    displayedWording: {},
    groups: [
      { key: 'items', title: 'Enclosures', pdfTitle: 'ENCLOSURES', continuedTitle: 'Enclosures continued', items: QC_INSPECTION_ITEMS },
      { key: 'gutters', title: 'Gutters', pdfTitle: 'GUTTERS', continuedTitle: 'Gutters continued', items: QC_GUTTER_ITEMS },
      { key: 'pergolaPan6', title: 'Pergola & Pan6', pdfTitle: 'PERGOLA & PAN6', continuedTitle: 'Pergola & Pan6 continued', items: QC_PERGOLA_PAN6_ITEMS },
      { key: 'general', title: 'General Section', pdfTitle: 'GENERAL SECTION', continuedTitle: 'General Section continued', items: QC_GENERAL_ITEMS },
      { key: 'inHouse', title: 'Corrections / Follow-Up', pdfTitle: 'CORRECTIONS / FOLLOW-UP', continuedTitle: 'Corrections / Follow-Up continued', items: QC_CORRECTIVE_ITEMS }
    ]
  }
};

const DEFAULT_DOCUMENT_TYPE = 'precon';
