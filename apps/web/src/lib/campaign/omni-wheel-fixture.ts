import type { CampaignFixture, Dependency, Evidence, Measurement, Protocol, Requirement, TestRecord } from './contracts';

const sourceUri = 'source://user-upload/1000312451.mp4';
const FIXTURE = { owner: 'FIXTURE' as const, sourceId: 'FIXTURE-OMNIWHEEL-2026-01', sourceUri, fixture: true };
const kup = (sourceId: string) => ({ owner: 'KUP' as const, sourceId, sourceUri, fixture: true });
const lab = (sourceId: string) => ({ owner: 'APORAKSHA_LAB' as const, sourceId, fixture: true });
const logic = (sourceId: string) => ({ owner: 'LOGICHUB' as const, sourceId, fixture: true });

const dependencies: Dependency[] = [
  ['ROLLER_GEOMETRY','Roller geometry',['continuous contact','lateral freedom','roller spacing']],
  ['ROLLER_MATERIAL','Roller material',['friction consistency','wear resistance','compression behaviour']],
  ['ROLLER_BEARINGS','Roller bearings / axles',['low drag','retention','alignment','debris tolerance']],
  ['HUB_BODY','Hub / wheel body',['radial stiffness','concentricity','roller-seat integrity']],
  ['BELT_DRIVE','Belt drive',['torque transmission','belt retention','tooth engagement']],
  ['TRACTION','Traction / contact',['longitudinal traction','slip control','surface compatibility']],
  ['RETENTION','Retention',['roller pull-out resistance','axle security','impact tolerance']],
  ['VIBRATION','Runout / vibration',['radial runout','axial runout','vibration RMS']],
  ['ROBOT_INTEGRATION','Robot integration',['forward motion','lateral motion','diagonal tracking']],
].map(([id,name,props]) => ({ id:String(id), name:String(name), description:`${name} dependency for the fabricated peripheral-roller wheel fixture.`, requiredProperties:props as string[], riskIds:[], provenance:kup(`KUP-DEP-${id}`) }));

const protocols: Protocol[] = [
  ['ATL-OMNI-FREE','Passive roller drag'],['ATL-OMNI-LATERAL','Lateral rolling resistance'],['ATL-OMNI-TRACTION','Longitudinal traction'],['ATL-OMNI-DIAGONAL','Diagonal tracking'],['ATL-OMNI-STATIC','Static radial load'],['ATL-OMNI-RUNOUT','Runout measurement'],['ATL-OMNI-RETENTION','Roller retention'],['ATL-OMNI-BELT','Belt torque transmission'],['ATL-OMNI-VIB','Dynamic vibration'],['ATL-OMNI-DEBRIS','Debris ingress / jam'],['ATL-OMNI-WET','Wet-surface behaviour'],['ATL-OMNI-ENDURANCE','Repeated-cycle endurance'],
].map(([id,title]) => ({ id, revision:'R01', title, owner:'APORAKSHA_LAB', provenance:lab(id) }));

function test(id:string,name:string,deps:string[],protocolId:string,status:TestRecord['status'],evidenceIds:string[]): TestRecord {
  return {
    id,name,purpose:`Evaluate ${name.toLowerCase()} for a bounded small-robot wheel duty.`,hypothesis:`${name} remains inside the configured fixture criterion.`,dependencyIds:deps,protocolId,protocolRevision:'R01',status,
    date:['READY','PLANNED'].includes(status)?undefined:'2026-08-23T09:30:00+05:30',operator:'OP-FIX-OMNI-01',reviewer:'REV-FIX-OMNI-01',configurationRevisionId:'TESTCFG-OMNI-R01',systemRevisionId:'OMNIWHEEL-R01',componentRevisionIds:['HUB-R01','ROLLER-R01','AXLE-R01','BELT-R01'],softwareRevisionIds:['CTRL-FW-R01'],
    environment:['SIMULATED: smooth indoor floor','SIMULATED: bounded small-robot normal load'],variables:['wheel speed','normal load','surface condition','command direction'],controls:['same surface','same configured normal load','same drive profile'],equipment:['SIMULATED force gauge','SIMULATED encoder','SIMULATED accelerometer','SIMULATED current logger'],calibrationState:'FIXTURE — real calibration evidence required',procedure:['Confirm revision IDs','Check roller freedom and belt alignment','Run protocol','Capture immutable evidence'],stopConditions:['roller separation','belt loss','fixture instability','measurement-integrity loss'],observation:status==='FAIL'?'SIMULATED OBSERVATION: configured criterion excursion recorded.':'SIMULATED OBSERVATION: fixture record captured.',calculation:'SIMULATED CALCULATION: fixture data only.',interpretation:status==='FAIL'?'SIMULATED INTERPRETATION: configured criterion not met.':'SIMULATED INTERPRETATION: result applies only to bounded duty.',claimImpact:status==='FAIL'?'Constrains support until narrowed scope or verified retest.':'Contributes only to linked requirements.',review:'FIXTURE REVIEW — not laboratory approval.',requiredEvidenceIds:evidenceIds,result:status,provenance:lab(id),
  };
}

const tests: TestRecord[] = [
  test('ROLL-FREE-01','Passive roller drag',['ROLLER_BEARINGS','ROLLER_GEOMETRY'],'ATL-OMNI-FREE','PASS',['EV-ROLL-FREE-RAW']),
  test('LATERAL-ROLL-01','Lateral rolling resistance',['ROLLER_GEOMETRY','ROLLER_MATERIAL','ROLLER_BEARINGS'],'ATL-OMNI-LATERAL','FAIL',['EV-LATERAL-RAW','EV-LATERAL-FAIL']),
  test('TRACTION-01','Longitudinal traction',['TRACTION','ROLLER_MATERIAL','HUB_BODY'],'ATL-OMNI-TRACTION','PASS',['EV-TRACTION-RAW']),
  test('DIAGONAL-01','Diagonal tracking',['ROBOT_INTEGRATION','ROLLER_GEOMETRY','TRACTION'],'ATL-OMNI-DIAGONAL','PASS',['EV-DIAGONAL-RAW']),
  test('STATIC-LOAD-01','Static radial load',['HUB_BODY','RETENTION'],'ATL-OMNI-STATIC','PASS',['EV-STATIC-REPORT']),
  test('RUNOUT-01','Radial / axial runout',['HUB_BODY','VIBRATION'],'ATL-OMNI-RUNOUT','PASS',['EV-RUNOUT-RAW']),
  test('RETENTION-01','Roller retention',['RETENTION','ROLLER_BEARINGS'],'ATL-OMNI-RETENTION','PASS',['EV-RETENTION-REPORT']),
  test('BELT-01','Belt torque transmission',['BELT_DRIVE','HUB_BODY'],'ATL-OMNI-BELT','PASS',['EV-BELT-RAW']),
  test('VIB-01','Dynamic vibration',['VIBRATION','HUB_BODY','ROLLER_GEOMETRY'],'ATL-OMNI-VIB','INCONCLUSIVE',['EV-VIB-RAW']),
  test('DEBRIS-01','Debris ingress / roller jam',['ROLLER_BEARINGS','ROLLER_GEOMETRY'],'ATL-OMNI-DEBRIS','FAIL',['EV-DEBRIS-RAW','EV-DEBRIS-FAIL']),
  test('WET-01','Wet-surface behaviour',['ROLLER_MATERIAL','TRACTION'],'ATL-OMNI-WET','READY',[]),
  test('ENDURANCE-01','Repeated-cycle endurance',['RETENTION','ROLLER_MATERIAL','ROLLER_BEARINGS','BELT_DRIVE'],'ATL-OMNI-ENDURANCE','READY',[]),
];

const requirements: Requirement[] = [
  ['REQ-FREE-ROLL','ROLLER_BEARINGS','Peripheral rollers must rotate with bounded parasitic drag.',false,['ROLL-FREE-01']],
  ['REQ-LATERAL','ROLLER_GEOMETRY','Configured lateral motion must remain below the resistance criterion.',true,['LATERAL-ROLL-01']],
  ['REQ-TRACTION','TRACTION','Driven-direction traction must meet the bounded robot criterion.',false,['TRACTION-01']],
  ['REQ-KINEMATICS','ROBOT_INTEGRATION','Diagonal tracking must remain inside the configured error envelope.',false,['DIAGONAL-01']],
  ['REQ-STRUCTURE','HUB_BODY','Wheel body must survive radial load and runout criteria.',false,['STATIC-LOAD-01','RUNOUT-01']],
  ['REQ-RETENTION','RETENTION','Rollers and axles must remain retained.',false,['RETENTION-01']],
  ['REQ-BELT','BELT_DRIVE','Belt drive must transmit configured torque without skip.',false,['BELT-01']],
  ['REQ-VIB','VIBRATION','Dynamic vibration must be characterized inside the integration limit.',true,['VIB-01']],
  ['REQ-DEBRIS','ROLLER_BEARINGS','Debris must not create an unacceptable jam rate.',true,['DEBRIS-01']],
  ['REQ-WET','ROLLER_MATERIAL','Wet-surface behaviour must be characterized before wet-duty support.',true,['WET-01']],
  ['REQ-ENDURANCE','RETENTION','Endurance must complete before unrestricted support.',true,['ENDURANCE-01']],
].map(([id,dependencyId,statement,conditionalAllowed,testIds]) => ({ id:String(id),dependencyId:String(dependencyId),statement:String(statement),critical:true,conditionalAllowed:Boolean(conditionalAllowed),claimScope:'DEFINED_SMALL_ROBOT_DUTY',testIds:testIds as string[],provenance:kup(String(id)) }));

const revisionIds = ['OMNIWHEEL-R00','OMNIWHEEL-R01','OMNIWHEEL-R02','HUB-R01','ROLLER-R00','ROLLER-R01','ROLLER-R02','AXLE-R01','BEARING-R01','BELT-R01','PULLEY-R01','MOTOR-R01','CTRL-FW-R01','TESTCFG-OMNI-R00','TESTCFG-OMNI-R01'];
const componentRevisions = revisionIds.map((id,index) => ({ id, component:id.startsWith('ROLLER')?'PERIPHERAL ROLLER':id.startsWith('OMNIWHEEL')?'SYSTEM':id.startsWith('TESTCFG')?'TEST CONFIGURATION':id.replace('-R01','').replaceAll('_',' '), parentMachineRevisionId:id.includes('R00')?'OMNIWHEEL-R00':id.includes('R02')?'OMNIWHEEL-R02':'OMNIWHEEL-R01', createdAt:`2026-08-${String(8+(index%12)).padStart(2,'0')}T10:00:00+05:30`, sourceCommit:`${String(index+1).padStart(2,'0')}${'e'.repeat(38)}`, state:(id==='OMNIWHEEL-R01'||(!id.includes('R00')&&!id.includes('R02'))?'CURRENT':'FIXTURE') as 'CURRENT'|'FIXTURE', provenance:logic(id) }));

function ev(id:string,type:Evidence['type'],testId:string,bound:string[],keys:string[],state:Evidence['state']='REVIEWED'): Evidence {
  return { id,type,source:'Aporaksha-Lab simulated fixture',sha256:`${id.replace(/[^A-Z0-9]/gi,'').toLowerCase().padEnd(64,'a').slice(0,64)}`,timestamp:'2026-08-23T10:00:00+05:30',testId,revisionId:bound[0],boundRevisionIds:bound,validityKeys:keys,state,staleReason:state==='STALE'?'SIMULATED: superseded roller configuration.':undefined,reviewState:state,artifactPath:`fixture://evidence/${id}`,provenance:lab(id) };
}
const evidence: Evidence[] = [
  ev('EV-ROLL-FREE-RAW','RAW_DATA','ROLL-FREE-01',['OMNIWHEEL-R01','ROLLER-R01','AXLE-R01','BEARING-R01'],['roller-bearing-drag','axle-alignment']),
  ev('EV-LATERAL-RAW','RAW_DATA','LATERAL-ROLL-01',['OMNIWHEEL-R01','ROLLER-R01'],['roller-profile','roller-hardness']),
  ev('EV-LATERAL-FAIL','FAILURE_REPORT','LATERAL-ROLL-01',['OMNIWHEEL-R01','ROLLER-R01'],['roller-profile','roller-hardness']),
  ev('EV-TRACTION-RAW','RAW_DATA','TRACTION-01',['OMNIWHEEL-R01','ROLLER-R01','HUB-R01'],['roller-profile','roller-hardness','hub-stiffness']),
  ev('EV-DIAGONAL-RAW','SENSOR_LOG','DIAGONAL-01',['OMNIWHEEL-R01','ROLLER-R01','CTRL-FW-R01'],['roller-profile','control-map']),
  ev('EV-STATIC-REPORT','TEST_REPORT','STATIC-LOAD-01',['OMNIWHEEL-R01','HUB-R01'],['hub-stiffness']),
  ev('EV-RUNOUT-RAW','RAW_DATA','RUNOUT-01',['OMNIWHEEL-R01','HUB-R01','ROLLER-R01'],['hub-concentricity','roller-profile']),
  ev('EV-RETENTION-REPORT','TEST_REPORT','RETENTION-01',['OMNIWHEEL-R01','ROLLER-R01','AXLE-R01'],['roller-retention','axle-retention']),
  ev('EV-BELT-RAW','SENSOR_LOG','BELT-01',['OMNIWHEEL-R01','BELT-R01','PULLEY-R01','MOTOR-R01'],['belt-alignment','pulley-teeth']),
  ev('EV-VIB-RAW','SENSOR_LOG','VIB-01',['OMNIWHEEL-R01','HUB-R01','ROLLER-R01'],['hub-concentricity','roller-profile'],'PRESENT'),
  ev('EV-DEBRIS-RAW','RAW_DATA','DEBRIS-01',['OMNIWHEEL-R01','ROLLER-R01','AXLE-R01'],['roller-clearance','roller-profile']),
  ev('EV-DEBRIS-FAIL','FAILURE_REPORT','DEBRIS-01',['OMNIWHEEL-R01','ROLLER-R01'],['roller-clearance']),
  ev('EV-ROLLER-R00-STALE','RAW_DATA','LATERAL-ROLL-01',['OMNIWHEEL-R00','ROLLER-R00'],['roller-profile'],'STALE'),
  ev('EV-SOURCE-VIDEO','VIDEO','ROLL-FREE-01',['OMNIWHEEL-R01'],['source-signal'],'PRESENT'),
];

const measurementRows: Array<[string,string,string,number,string]> = [
  ['M-OM-001','ROLL-FREE-01','passive_roller_drag',0.42,'N'],['M-OM-002','ROLL-FREE-01','roller_free_rpm',118,'rpm'],
  ['M-OM-003','LATERAL-ROLL-01','lateral_drag_force',3.8,'N'],['M-OM-004','LATERAL-ROLL-01','lateral_velocity',0.19,'m/s'],
  ['M-OM-005','TRACTION-01','longitudinal_force',18.6,'N'],['M-OM-006','TRACTION-01','slip_ratio',7.4,'%'],['M-OM-007','TRACTION-01','wheel_rpm',176,'rpm'],['M-OM-008','TRACTION-01','drive_current',2.8,'A'],
  ['M-OM-009','DIAGONAL-01','heading_error',4.2,'deg'],['M-OM-010','DIAGONAL-01','diagonal_velocity',0.23,'m/s'],
  ['M-OM-011','STATIC-LOAD-01','radial_deflection',0.32,'mm'],['M-OM-012','STATIC-LOAD-01','fixture_radial_load',80,'N'],
  ['M-OM-013','RUNOUT-01','radial_runout',0.48,'mm'],['M-OM-014','RUNOUT-01','axial_runout',0.27,'mm'],
  ['M-OM-015','RETENTION-01','roller_pullout_force',42,'N'],['M-OM-016','RETENTION-01','roller_release_events',0,'count'],
  ['M-OM-017','BELT-01','belt_skip_events',0,'count'],['M-OM-018','BELT-01','drive_current_peak',3.1,'A'],
  ['M-OM-019','VIB-01','vibration_rms',0.46,'g'],['M-OM-020','VIB-01','vibration_peak',1.9,'g'],
  ['M-OM-021','DEBRIS-01','roller_jam_events',1,'count'],['M-OM-022','DEBRIS-01','drag_increase',38,'%'],
  ['M-OM-023','DEBRIS-01','recovery_time',12,'s'],['M-OM-024','ROLL-FREE-01','roller_count',12,'count'],
];
const measurements: Measurement[] = measurementRows.map(([id,testId,metric,value,unit]) => ({ id,testId,timestamp:'2026-08-23T10:05:00+05:30',metric,value,unit,provenance:lab(id) }));

export const omniWheelFixture: CampaignFixture = {
  label:'SIMULATED FIXTURE DATA',
  campaign:{ id:'omnidirectional-roller-wheel-small-robot-duty',name:'Fabricated Omni Roller Wheel — Small-Robot Duty Validation',state:'TESTING',claimId:'KUP-CLAIM-OMNIWHEEL-001',testCampaignId:'ATL-OMNIWHEEL-2026-01',evidencePackageId:'EVPK-OMNI-0001',currentRevisionId:'OMNIWHEEL-R01',lastEvidenceUpdate:'2026-08-23T10:32:00+05:30',provenance:FIXTURE },
  claim:{ id:'KUP-CLAIM-OMNIWHEEL-001',text:'This fabricated roller wheel can function as an omnidirectional drive wheel in a defined small-robot duty.',type:'performance / mechanism capability',subject:'fabricated peripheral-roller wheel shown in user video',context:'bounded small-robot drive on a smooth indoor test surface',comparator:'reference omni wheel — comparison evidence unavailable',operatingConditions:['bounded normal load','low-speed forward/lateral/diagonal motion','smooth indoor surface','declared debris/wet exclusions until tested'],successCriteria:['peripheral rollers rotate with bounded drag','driven-direction traction meets criterion','diagonal tracking meets error criterion','no unresolved retention or belt-drive failure','wet/debris/endurance limits explicitly characterized before broad support'],definedDuty:'Low-speed small-robot forward, lateral and diagonal motion with start/stop cycles.',activities:['forward drive','lateral translation','diagonal tracking','start/stop','debris challenge','endurance'],whatWouldMakeFalse:['roller drag prevents lateral motion','longitudinal slip prevents commanded motion','roller/axle retention fails','belt skips under required torque','runout/vibration exceeds integration criterion','debris repeatedly jams rollers','endurance fails before required cycles'],signalSource:'User-supplied video 1000312451.mp4 showing CAD/fabrication of a wheel body with multiple peripheral rollers, assembly around the circumference, bearings/axles and a toothed-belt-driven robot-wheel prototype. The video does not establish load, speed, life, efficiency or production performance.',investigationReason:'The source is treated only as a KUP mechanism signal. Public omni-wheel terminology may help classify the concept, but no external specification is imported as campaign evidence.',state:'TESTING',provenance:kup('KUP-CLAIM-OMNIWHEEL-001') },
  dependencies,requirements,protocols,tests,measurements,evidence,componentRevisions,
  measurementCards:[{label:'LONGITUDINAL FORCE',metric:'longitudinal_force'},{label:'LATERAL DRAG',metric:'lateral_drag_force'},{label:'WHEEL SPEED',metric:'wheel_rpm'},{label:'DRIVE CURRENT',metric:'drive_current'},{label:'SLIP RATIO',metric:'slip_ratio'},{label:'VIBRATION RMS',metric:'vibration_rms'},{label:'BELT SKIP EVENTS',metric:'belt_skip_events'},{label:'ROLLER JAM EVENTS',metric:'roller_jam_events'},{label:'ENDURANCE',fallback:'INCOMPLETE'}],
  failures:[
    {id:'OM-FAIL-001',time:'2026-08-23T09:46:00+05:30',testId:'LATERAL-ROLL-01',severity:'HIGH',componentId:'ROLLER-R01',configurationRevisionId:'TESTCFG-OMNI-R01',description:'SIMULATED lateral rolling resistance exceeded the configured criterion.',rootCause:'Fixture hypothesis: roller profile/material interaction.',status:'ROOT_CAUSE_FOUND',provenance:lab('OM-FAIL-001')},
    {id:'OM-FAIL-002',time:'2026-08-23T10:08:00+05:30',testId:'DEBRIS-01',severity:'MEDIUM',componentId:'ROLLER-R01',configurationRevisionId:'TESTCFG-OMNI-R01',description:'SIMULATED particle lodged near one roller and increased drag.',rootCause:'Fixture hypothesis: insufficient roller-to-carrier clearance.',status:'UNDER_INVESTIGATION',provenance:lab('OM-FAIL-002')},
    {id:'OM-FAIL-003',time:'2026-08-22T16:20:00+05:30',testId:'BELT-01',severity:'MEDIUM',componentId:'BELT-R01',configurationRevisionId:'TESTCFG-OMNI-R00',description:'SIMULATED belt walk observed in superseded alignment fixture.',rootCause:'Pulley alignment offset in superseded setup.',status:'FIX_VERIFIED',provenance:lab('OM-FAIL-003')},
  ],
  changes:[{id:'EC-ROLLER-002',component:'PERIPHERAL ROLLER',fromRevisionId:'ROLLER-R01',toRevisionId:'ROLLER-R02',machineRevisionId:'OMNIWHEEL-R02',changedAttributes:['roller-profile','roller-hardness'],whatChanged:'SIMULATED fixture change: roller contact profile and compliant surface hardness modified.',why:'Fixture investigation links lateral resistance and debris sensitivity to roller contact/clearance behaviour.',reason:'Roller geometry/material changed; evidence depending on the prior roller profile or hardness requires re-verification.',affectedRequirementIds:['REQ-LATERAL','REQ-TRACTION','REQ-KINEMATICS','REQ-VIB','REQ-DEBRIS','REQ-ENDURANCE'],provenance:logic('EC-ROLLER-002')}],
  timeline:[
    {id:'OM-TL-001',timestamp:'2026-08-23T08:45:00+05:30',type:'SOURCE_SIGNAL',title:'Source mechanism observed',detail:'User video registered as a KUP source signal; no performance result imported.',linkedIds:['KUP-CLAIM-OMNIWHEEL-001']},
    {id:'OM-TL-002',timestamp:'2026-08-23T08:55:00+05:30',type:'CLAIM_CREATED',title:'Bounded capability claim created',detail:'Claim limited to defined small-robot duty.',linkedIds:['KUP-CLAIM-OMNIWHEEL-001']},
    {id:'OM-TL-003',timestamp:'2026-08-23T09:05:00+05:30',type:'PROGRAM_APPROVED',title:'Test program fixture linked',detail:'Aporaksha-Lab fixture protocols attached.',linkedIds:['ATL-OMNIWHEEL-2026-01']},
    {id:'OM-TL-004',timestamp:'2026-08-23T09:46:00+05:30',type:'FAILURE',title:'Lateral resistance criterion failed',detail:'Fixture failure OM-FAIL-001 captured.',linkedIds:['OM-FAIL-001','LATERAL-ROLL-01']},
    {id:'OM-TL-005',timestamp:'2026-08-23T10:18:00+05:30',type:'ENGINEERING_CHANGE',title:'Roller R02 change proposed',detail:'LogicHub semantic change targets roller profile/hardness.',linkedIds:['EC-ROLLER-002']},
  ],
  economicAssumptions:[{id:'OM-ECON-MFG',name:'Manufacturing cost per wheel',unit:'₹/wheel',state:'MISSING',note:'No verified BOM, print time, roller material cost or labour supplied.',provenance:FIXTURE},{id:'OM-ECON-ROLLER',name:'Replacement roller cost',unit:'₹/roller',state:'MISSING',note:'Requires real material/process data.',provenance:FIXTURE},{id:'OM-ECON-MAINT',name:'Maintenance cost',unit:'₹/100 h',state:'MISSING',note:'Requires endurance and service records.',provenance:FIXTURE}],
  comparator:[{id:'OM-CMP-LATERAL',metric:'lateral rolling resistance',candidateValue:3.8,unit:'N',candidateEvidenceId:'EV-LATERAL-RAW',state:'FIXTURE'},{id:'OM-CMP-TRACTION',metric:'longitudinal traction',candidateValue:18.6,unit:'N',candidateEvidenceId:'EV-TRACTION-RAW',state:'FIXTURE'},{id:'OM-CMP-VIB',metric:'vibration RMS',candidateValue:0.46,unit:'g',candidateEvidenceId:'EV-VIB-RAW',state:'FIXTURE'},{id:'OM-CMP-ENDURANCE',metric:'endurance',unit:'cycles',state:'UNAVAILABLE'}],candidateLabel:'CANDIDATE',referenceLabel:'REFERENCE OMNI WHEEL',
  dutyCycleQuestion:'Where does the fabricated omni roller wheel struggle?',dutyCycle:[
    {id:'OM-DUTY-1',name:'FORWARD',metrics:[{label:'wheel speed',value:160,unit:'rpm'},{label:'slip',value:6.8,unit:'%'}],faults:0,derating:false},
    {id:'OM-DUTY-2',name:'LATERAL',metrics:[{label:'drag',value:3.8,unit:'N'},{label:'velocity',value:0.19,unit:'m/s'}],faults:1,derating:false},
    {id:'OM-DUTY-3',name:'DIAGONAL',metrics:[{label:'heading error',value:4.2,unit:'deg'},{label:'velocity',value:0.23,unit:'m/s'}],faults:0,derating:false},
    {id:'OM-DUTY-4',name:'START / STOP',metrics:[{label:'cycles',value:25},{label:'belt skip',value:0,unit:'count'}],faults:0,derating:false},
    {id:'OM-DUTY-5',name:'VIBRATION',metrics:[{label:'vibration RMS',value:0.46,unit:'g'},{label:'result',value:'INCONCLUSIVE'}],faults:0,derating:false},
    {id:'OM-DUTY-6',name:'DEBRIS',metrics:[{label:'jam events',value:1,unit:'count'},{label:'drag increase',value:38,unit:'%'}],faults:1,derating:false},
    {id:'OM-DUTY-7',name:'ENDURANCE',metrics:[{label:'status',value:'INCOMPLETE'},{label:'required evidence',value:'MISSING'}],faults:0,derating:false},
  ],
  timeSeriesSeries:[{key:'wheelRpm',label:'WHEEL RPM',unit:'rpm'},{key:'rollerRpm',label:'ROLLER RPM',unit:'rpm'},{key:'driveCurrent',label:'DRIVE CURRENT',unit:'A'},{key:'longitudinalForce',label:'LONG. FORCE',unit:'N'},{key:'lateralDrag',label:'LATERAL DRAG',unit:'N'},{key:'slipRatio',label:'SLIP RATIO',unit:'%'},{key:'vibrationRms',label:'VIBRATION RMS',unit:'g'},{key:'lateralVelocity',label:'LATERAL VELOCITY',unit:'m/s'}],
  timeSeries:Array.from({length:31},(_,index)=>({t:index*2,wheelRpm:30+Math.min(150,index*8)-(index>22?(index-22)*3:0),rollerRpm:20+(index%7)*16+(index>=10&&index<=18?45:0),driveCurrent:0.8+(index%5)*0.35+(index>=18&&index<=23?1.2:0),longitudinalForce:4+(index%6)*2.6+(index>=6&&index<=13?5:0),lateralDrag:0.9+(index%4)*0.5+(index>=14&&index<=21?1.8:0),slipRatio:2+(index%5)*1.2+(index>=18&&index<=23?3.5:0),vibrationRms:0.12+(index%6)*0.045+(index>=22?0.18:0),lateralVelocity:index>=10&&index<=21?0.08+(index%5)*0.035:0.02})),
  testEvents:[{id:'OM-EVT-1',t:20,label:'Lateral command begins'},{id:'OM-EVT-2',t:36,label:'High lateral drag observed'},{id:'OM-EVT-3',t:48,label:'Debris exposure / vibration rise'}],
  acceptanceScenario:{title:'SUPPORTED → roller R02 change → REVIEW_REQUIRED / CONDITIONAL',detail:'Fixture-only mode closes declared lateral, vibration, debris, wet and endurance gaps, then changes the roller profile/hardness. R01-dependent evidence becomes stale deterministically.',passTestIds:['LATERAL-ROLL-01','VIB-01','DEBRIS-01','WET-01','ENDURANCE-01'],revisionSensitiveTestIds:['LATERAL-ROLL-01']},
  decisionScope:'DEFINED_SMALL_ROBOT_DUTY',currentRevisionId:'OMNIWHEEL-R01',
};
