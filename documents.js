'use strict';

const CUSTOMER_ACK_OPTIONS = ['', 'Customer Acknowledges', 'N/A'];

/* Text blocks displayed on the form for selected checklist options */
const DISPLAYED_WORDING = {
  irrigationLines: [['Customer Acknowledges', "Customer understands and acknowledges that Absolute Aluminum will not handle anything to do with sprinklers/lines etc. and that it is the customer's responsibility."]],
  bushes: [['Customer Acknowledges', 'Customer understands and acknowledges their responsibility to ensure the work area is prepared and cleared of vegetation prior to our arrival. A minimum of 2 feet of clearance is required around the work area. Vegetation taller than 3 feet must be trimmed down to allow safe ladder placement and access.']],
  sitePrep: [['Customer Acknowledges', 'Customer understands and acknowledges that Absolute Aluminum is not responsible for any damage to landscaping, sod, sprinklers, yard ruts etc. in work area. In some instances, we will hold off on your project during the rainy season to avoid severe damage to your yard. Re-sodding around foundation work is not included.']],
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
  { id: 'state', label: 'State', type: 'text', autocomplete: 'address-level1', maxLength: 2, placeholder: 'FL', defaultValue: 'FL' },
  { id: 'zip', label: 'ZIP Code', type: 'text', autocomplete: 'postal-code', inputMode: 'numeric', maxLength: 10, placeholder: '12345' }
];

const JOB_FIELDS = [
  { id: 'firstName', label: 'First Name', type: 'text', autocomplete: 'given-name' },
  { id: 'lastName', label: 'Last Name', type: 'text', autocomplete: 'family-name' },
  ...ADDRESS_FIELDS,
  { id: 'email', label: 'Email', type: 'email' },
  { id: 'phone', label: 'Phone #', type: 'tel' },
  { id: 'jobNumberPhase', label: 'Job # and Phase', type: 'text' },
  { id: 'gateCode', label: 'Gate Code', type: 'text' },
  { id: 'preconSpecialist', label: 'Pre-Construction Specialist', type: 'text', defaultValue: 'Mark Popp' }
];

const INSTALL_CREW_OPTIONS = [
  'N/A',
  'Sean & Javier',
  'Rich & Freddy',
  'Alex L, Eddie I and Eddie II',
  'Marco & Roger',
  'Manuel,Yael & Uriel',
  'Alejandro, Misael & Armando',
  'Adam E',
  'Josh F',
  'Tim R',
  'Basillio'
];

const INSPECTION_ITEMS = [
  { id: 'irrigationLines', label: 'Irrigation Lines', options: CUSTOMER_ACK_OPTIONS },
  { id: 'bushes', label: 'Bushes', options: CUSTOMER_ACK_OPTIONS },
  { id: 'equipment', label: 'Equipment', input: 'text' },
  { id: 'sitePrep', label: 'Site Prep', options: CUSTOMER_ACK_OPTIONS },
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
  { id: 'warrantyInformation', label: 'Warranty Information', options: ['', '1 Year Commercial Project Warranty','10 Year Abso-Shield', 'N/A'] },
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
  { id: 'compositePanels', label: 'Composite Panels', input: 'text' },
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
  { id: 'deckMeasurements', label: 'Deck Measurements', input: 'text' },
  { id: 'bayWindowMeasurements', label: 'Bay Window Measurements', input: 'text' },
  { id: 'noc', label: 'NOC', options: ['', 'Needs Signature/Submittal', 'Signed and Submitted', 'N/A'] }
];

const QC_JOB_FIELDS = [
  { id: 'firstName', label: 'First Name', type: 'text', autocomplete: 'given-name' },
  { id: 'lastName', label: 'Last Name', type: 'text', autocomplete: 'family-name' },
  ...ADDRESS_FIELDS,
  { id: 'email', label: 'Email', type: 'email' },
  { id: 'phone', label: 'Phone #', type: 'tel' },
  { id: 'jobNumberPhase', label: 'Job # and Phase', type: 'text' },
  { id: 'gateCode', label: 'Gate Code', type: 'text' },
  { id: 'qcSpecialist', label: 'QC Specialist', type: 'text', defaultValue: 'Rich Shroka' },
  {
    id: 'installCrew',
    label: 'Install Crew',
    options: INSTALL_CREW_OPTIONS
  },
  {
    id: 'installCrew2',
    label: 'Install Crew 2',
    options: INSTALL_CREW_OPTIONS,
    additionalInstallCrew: true,
    previousCrewField: 'installCrew'
  },
  {
    id: 'installCrew3',
    label: 'Install Crew 3',
    options: INSTALL_CREW_OPTIONS,
    additionalInstallCrew: true,
    previousCrewField: 'installCrew2'
  },
  {
    id: 'installCrew4',
    label: 'Install Crew 4',
    options: INSTALL_CREW_OPTIONS,
    additionalInstallCrew: true,
    previousCrewField: 'installCrew3'
  },
  { id: 'concreteCrew', label: 'Concrete Crew', options: ['', 'Canine Concrete', 'Wagle Concrete', 'Level Up Innovations'] }
];

const MATERIAL_GROUPS = [
  {
    name: 'Fasteners',
    items: [
      '1-3/4" Quickset',
      '2-1/4" Quickset',
      '3-1/4" Quickset',
      '5" Quickset',
      '6" Quickset',
      '3/8 x 3" Bolt SS LTD',
      '3/8 x 5" Bolt SS LTD',
      '3/8 x 7" Bolt SS LTD',
      '3" Self Tapper SS',
      '8 x 1/2" SS',
      '10 x 1" SS',
      '10 x 3/4" SS',
      '10 x 1-1/2" SS',
      '10 x 2" SS',
      '10 x 3" SS',
      '10 x 4" SS',
      '12 x 3/4" SS',
      '12 x 1" SS',
      '12 x 2" SS',
      '14 X 1" SS',
      '10 x 2" Nylo-Tec',
      '10 x 3" Nylo-Tec',
      '12 x 1" Nylo-Tec',
      '14 x 1" Nylo-Tec',
      '18 x 2" Nylo-Tec',
      'Blue Tap 1-3/4" Pro-Tect',
      'Blue Tap 2-1/4" Pro-Tect',
      'Blue Tap 3-1/4" Pro-Tect',
      'Blue Tap 5" Pro-Tect',
      'Blue Tap 6" Pro-Tect',
      'EZ Cleans',
      'Cap',
      'Washer',
      'Shank'
    ]
  },
  {
    name: 'Extrusion',
    items: [
      '1 x 2"',
      '2 x 2"',
      '1/2 x 2" Patio w/ Spline Groove',
      '2 x 3" Patio',
      '2 x 4" Patio',
      '3 x 3 x .093" SQ TUBE',
      '3 x 3 x .125" SQ TUBE',
      '4 x 4 x .125" SQ TUBE',
      '1 x 3" OB',
      '2" Receiving Channel',
      '3" Receiving Channel',
      '4" Receiving Channel',
      'Extruded Kick Plate',
      'Pass Thru Door',
      'Corner Jack',
      '2 x 4" SMB',
      '2 x 5" SMB',
      '2 x 6" SMB',
      '2 x 7" SMB',
      '2 x 8" SMB',
      '2 x 9" SMB',
      '2 x 10" SMB',
      '1 x 1" AR Angle',
      '1 x 2" AR Angle',
      '2 x 2" AR Angle',
      '1 x 1" Angle',
      '1 x 2" Angle',
      '1 x 3" Angle',
      '2 x 2" Angle',
      '3 x 3" Angle',
      '2 x 2" Angle w/ 3 holes',
      '2 x 2" Angle w/ 6 holes',
      '2 x 2" Angle w/ 8 holes',
      '1 x 1" Capri Clips',
      '2" Internal Clips',
      '3" Inserts w/ Flange',
      '12\' Tie Down Cable w/ Triangle',
      '14\' Tie Down Cable w/ Triangle',
      '16\' Tie Down Cable w/ Triangle',
      '18\' Tie Down Cable w/ Triangle'
    ]
  },
  {
    name: 'Screen',
    items: [
      'Spline',
      '18/14 Screen',
      '20/20 Screen',
      'Regular TUFF Screen ',
      'Solar Screen',
      'NO-SEE-UM TUFF Screen',
      'Pet Screen',
      'Florida Glass',
      '16" Kickplate Coil',
      '24" Kickplate Coil',
      '10" Fascia W/G, and Smooth',
      'Breakform Fascia up to 12"',
      'Spray Paint',
      'Touch Up Paint',
      'MFM 3" x 33.5\' Peel & Seal',
      'Nova Flex',
      'Vulkem Sealer',
      'MFM 4" x 33.5\' Peel & Seal',
      'Kickplate Trim'
    ]
  },
  {
    name: 'Gutter',
    items: [
      '6" K Gutter',
      '7" K Gutter',
      '5" Super Gutter',
      '7" Super Gutter',
      '6" Gutter Solution',
      '3" Header',
      '6" Diverter',
      'Inside Box Miter',
      'Outside Box Miter',
      '6" Hanger',
      '7" Hanger',
      '6" End Cap',
      '7" End Cap',
      '5" Super Gutter End Cap',
      '7" Super Gutter End Cap',
      '6" Wedge',
      '7" Wedge',
      '3x4" Downspout',
      '4x5" Downspout',
      '3x4" Drop Out',
      '4x5" Drop Out',
      '3x4" A Elbow',
      '4x5" A Elbow',
      '3x4" B Elbow',
      '4x5" B Elbow',
      '3x4" Offset',
      '4x5" Offset',
      'Concrete Splash Block',
      '4oz. Perma Sealer',
      'Nova Flex',
      'Vulkem Sealer'
    ]
  },
  {
    name: 'Door',
    items: [
      '36" x 80" screen door with standard handle',
      '42" x 80" screen door with standard handle',
      '72" x 80" double screen door with astragal and standard handle',
      '36" x 80" Suntech seaview door with Tazman handles & Piano hinge',
      '42" x 80" Suntech seaview door with Tazman handles & Piano hinge',
      '72" x 80" Suntech double seaview door with Tazman handles & Piano hinge',
      '42" x 96" Suntech seaview door with Tazman handles & Piano hinge',
      'Astragal',
      'Suntech Door Handle',
      'Tazman Door Handle',
      'Standard Z-Bar',
      'Suntech Z-Bar',
      'Standard Closer Kit',
      'Suntech Closer Kit',
      'Key Lock',
      'Standard Hinge',
      'Piano Hinge',
      '36" Standard Bug Sweep',
      '42" Standard Bug Sweep',
      '36" Suntech Bug Sweep w/ Felt',
      '42" Suntech Bug Sweep w/ Felt',
      'Suntech Felt',
      'Small Dog Door (4 3/4" x 7 1/2")',
      'Medium Dog Door (8 1/2" x 12 1/2")',
      'Large Dog Door (11 1/2" x 16 7/8")',
      'X-Large Dog Door (14 1/2" x 19 1/2")'
    ]
  },
  {
    name: 'Miscellaneous',
    items: []
  }
];
const MATERIAL_JOB_FIELDS = [
  ...QC_JOB_FIELDS.filter(field => ['firstName', 'lastName', 'streetAddress', 'city', 'state', 'jobNumberPhase'].includes(field.id))
];

const QC_INSPECTION_ITEMS = [
  { id: 'superGutterSeamsFastened', label: 'Super Gutter seams neatly fastened and leak free', options: ['', 'Yes', 'No'] },
  { id: 'doorsOperationalAndLock', label: 'Doors are operational and lock', options: ['', 'Yes', 'No'] },
  { id: 'doorKeepersRemovedExplained', label: 'Door keepers removed and explained to customers', options: ['', 'Yes', 'N/A'] },
  { id: 'bugSweepsNoGaps', label: 'Bug sweeps installed with no gaps', options: ['', 'Yes', 'No'] },
  { id: 'weepHoleAtBeamCaps', label: 'Weep hole at beam caps', options: ['', 'Yes', 'No'] },
  { id: 'screwProtecCapsComplete', label: 'Screw/Protec caps fasteners are complete', options: ['', 'Yes', 'No'] },
  { id: 'caulkingInsideOutside', label: 'Caulking is applied inside and outside', options: ['', 'Yes', 'No'] },
  { id: 'ezCleansProperlyInstalled', label: 'EZ Cleans are properly installed', options: ['', 'Yes', 'No'] },
  { id: 'beamCapsInstalledProperly', label: 'Beam caps installed properly', options: ['', 'Yes', 'No'] },
  { id: 'screenFreeOfDefects', label: 'Screen is free of defects, wrinkles, and bubbles', options: ['', 'Yes', 'No'] },
  { id: 'cableNutsTightNoPaverRub', label: 'Cables and cable nuts are tight and not rubbing on pavers', options: ['', 'Yes', 'No'] },
  { id: 'groundWireAttached', label: 'Ground wire is attached from cage to pump', options: ['', 'Yes', 'No'] },
  { id: 'retractableScreensOperational', label: 'Retractable screens are operational', options: ['', 'Yes', 'No'] }
];

const QC_GUTTER_ITEMS = [
  { id: 'downspoutsProperLocation', label: 'Downspouts installed in proper location', options: ['', 'Yes', 'No'] },
  { id: 'downspoutElbowsExtensionsInstalled', label: 'Downspout extensions are installed properly', options: ['', 'Yes', 'No'] },
  { id: 'divertersInstalled', label: 'Diverters Installed', options: ['', 'Yes', 'No'] },
  { id: 'leafGuardInstalled', label: 'Leaf Guard system installed', options: ['', 'Yes', 'No'] },
  { id: 'superGutterSeamsLeakFree', label: 'Super gutter seams are fastened tight and leak free', options: ['', 'Yes', 'No'] },
  { id: 'endCapsMittersSealedLeakFree', label: 'End caps and mitters are sealed', options: ['', 'Yes', 'No'] },
  { id: 'hiddenHangersSealed', label: 'Hidden hangers are properly spaced and attached', options: ['', 'Yes', 'No'] }
];
const QC_PERGOLA_PAN6_ITEMS = [
  { id: 'louversOperational', label: 'Louvers are operational', options: ['', 'Yes', 'No'] },
  { id: 'fansLightsOperational', label: 'Fans/lights are operational', options: ['', 'Yes', 'No'] },
  { id: 'materialScratchDentFree', label: 'Material is scratch & dent free', options: ['', 'Yes', 'No'] },
  { id: 'superGutterSeamsNeatLeakFree', label: 'Super gutter seams are fastened neat and leak free', options: ['', 'Yes', 'No'] },
  { id: 'doorsOperationalAndLockPergola', label: 'Doors are operational and lock', options: ['', 'Yes', 'No'] },
  { id: 'doorKeepersRemovedExplainedPergola', label: 'Door keepers removed and explained to customers', options: ['', 'Yes', 'N/A'] },
  { id: 'bugSweepsNoGapsPergola', label: 'Bug sweeps installed with no gaps', options: ['', 'Yes', 'No'] },
  { id: 'weepHoleAtBeamCapsPergola', label: 'Weep hole at beam caps', options: ['', 'Yes', 'No'] },
  { id: 'screwProtecCapsCompletePergola', label: 'Screw/Protec caps fasteners are complete', options: ['', 'Yes', 'No'] },
  { id: 'caulkingInsideOutsidePergola', label: 'Caulking is applied inside and outside', options: ['', 'Yes', 'No'] },
  { id: 'ezCleansProperlyInstalledPergola', label: 'EZ cleans are properly installed', options: ['', 'Yes', 'No'] },
  { id: 'screenFreeOfDefectsPergola', label: 'Screen is free of defects, wrinkles & bubbles', options: ['', 'Yes', 'No'] },
  { id: 'retractableScreensOperationalPergola', label: 'Retractable screens are operational', options: ['', 'Yes', 'No'] }
];

const QC_GENERAL_ITEMS = [
  { id: 'jobSiteClean', label: 'Job Site Clean', options: ['', 'Yes', 'No'] },
  { id: 'completionPerContract', label: 'Completion of Job per Contract', options: ['', 'Yes', 'No'] },
  { id: 'permitPosted', label: 'Permit Posted', options: ['', 'Yes', 'No', 'N/A'] },
  { id: 'overallSatisfaction', label: 'Overall Satisfaction', options: ['', 'Satisfied', 'Unsatisfied'] },
  { id: 'surveys', label: 'Google Review and Guild Quality Survey', options: ['', 'Yes', 'No'] },
  { id: 'paymentCollected', label: 'Payment Collected', options: ['', 'Yes', 'No', 'N/A'] },
  { id: 'tervisTumblers', label: 'Tervis Tumblers', options: ['', 'Yes', 'No'] }
];

const QC_CONCRETE_INSPECTION_ITEMS = [
  { id: 'deckToppingStainPaversTravertineInstalled', label: 'Deck topping, stain, pavers, travertine are installed', options: ['', 'Yes', 'No'] },
  { id: 'doorPadInstalledProperly', label: 'Door pad installed properly', options: ['', 'Yes', 'No'] },
  { id: 'concreteAreaCleanOfDebris', label: 'Area is left clean of debris (form boards, concrete chunks, dirt mounds)', options: ['', 'Yes', 'No'] },
  { id: 'oversplashWipedOffHouseWindows', label: 'All over splash is wiped off house and windows', options: ['', 'Yes', 'No'] }
];

const QC_INSPECTION_RESULT_ITEMS = [
  {
    id: 'inspectionResults',
    label: 'Inspection Results',
    options: [
      'Call in for county inspection',
      'No county inspection required',
      'Punch List Required Before County Inspection',
      'Permit needs revise before Inspection',
      'Call in for inspection after permit is posted',
      'No Inspection, needs PC'
    ]
  },
  { id: 'punchListScheduleWeekOf', label: 'Punch List Schedule week of', type: 'date' }
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
    fields: QC_JOB_FIELDS,
    displayedWording: {},
    groups: [
      { key: 'items', title: 'Enclosures', pdfTitle: 'ENCLOSURES', continuedTitle: 'Enclosures continued', items: QC_INSPECTION_ITEMS },
      { key: 'gutters', title: 'Gutters', pdfTitle: 'GUTTERS', continuedTitle: 'Gutters continued', items: QC_GUTTER_ITEMS },
      { key: 'pergolaPan6', title: 'Pergola & Pan6', pdfTitle: 'PERGOLA & PAN6', continuedTitle: 'Pergola & Pan6 continued', items: QC_PERGOLA_PAN6_ITEMS },
      { key: 'concreteInspection', title: 'Concrete', pdfTitle: 'CONCRETE', continuedTitle: 'Concrete continued', items: QC_CONCRETE_INSPECTION_ITEMS },
      { key: 'general', title: 'General Section', pdfTitle: 'GENERAL SECTION', continuedTitle: 'General Section continued', items: QC_GENERAL_ITEMS },
      { key: 'inHouse', title: 'Inspection Results', pdfTitle: 'INSPECTION RESULTS', continuedTitle: 'Inspection Results continued', items: QC_INSPECTION_RESULT_ITEMS }
    ]
  },
  materialList: {
    id: 'materialList',
    label: 'Material List',
    shortLabel: 'Material List',
    title: 'Material List',
    pdfTitle: 'MATERIAL LIST',
    filenameLabel: 'MaterialList',
    defaultFilename: 'MaterialList',
    summaryPlaceholder: 'Enter material list notes...',
    fields: MATERIAL_JOB_FIELDS,
    displayedWording: {},
    groups: []
  }
};

const DEFAULT_DOCUMENT_TYPE = 'precon';
