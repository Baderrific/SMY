// Everything the report uses that does not change from month to month lives here.

const ROLES = {
	ADMIN: 'admin',
	ATL: 'atl',          // Assistant Team Leader: can input data
	MANAGER: 'manager'   // Manager / Staff: can only view
};

// 3 areas x 4 teams = 12 teams. Each area has 4 lines named after it (YC1-YC4, YA1-YA4, YB1-YB4).
const AREAS = ['YA', 'YB', 'YC'];
const TEAMS = ['A', 'B', 'C', 'D'];
const linesFor = (area) => [1, 2, 3, 4].map(n => `${area}${n}`);
const ALL_LINES = AREAS.flatMap(linesFor);
const LINES = linesFor('YC');   // default used by the calculations when no area is given
const teamKeyOf = (area, team) => `${area}-${team}`;   // for example "YC-D"
const TEAM_KEY_RE = /^Y[ABC]-[A-D]$/;

// Attendance codes, in the same order as the Attendance Summary sheet
const LEAVE_CODES = {
	VL: 'Vacation leave',
	SL: 'Sick leave',
	EL: 'Emergency leave',
	AWP: 'Absent with permission',
	AWOL: 'Absence without permission',
	SUS: 'Suspended',
	HL: 'Leave on a holiday',
	XL: 'Leave on an excess of 40 hrs. in a week',
	PL: 'Paternity leave',
	ST: 'On seminar / training',
	OB: 'On official business',
	CS: 'Change shift',
	UT: 'Undertime',
	UL: 'Union leave',
	LATE: 'Tardiness',
	CWS: 'CWS'
};

const DOWNTIME_GROUPS = {
	FEEDER: 'Feeder',
	IS_MACHINE: 'I.S. machine',
	WARE_HANDLING: 'Ware handling',
	OTHERS: 'Others'
};

// The items listed in the Downtime report. The ATL can pick from these or type a new one.
const DOWNTIME_ITEMS = {
	FEEDER: [
		'Biosol pump', 'Drop guide', 'Feeder plunger', 'Feeder tube', 'Gob distributor', 'Gob missed-delivery',
		'Orifice', 'Scoop', 'Shear arm', 'Shear blade', 'Shear spray', 'Weight fluctuation'
	],
	IS_MACHINE: [
		'Baffle arm / plate', 'Blow head', 'Bottom plate / adaptor', 'Dead plate', 'Final blow', 'Finish cooling',
		'Funnel / funnel arm', 'Holder', 'Invert/revert mech.', 'Jamming', 'Neck ring arm', 'Plunger / tube cooler',
		'Plunger mech.', 'Positioner', 'Shutter mech.', 'Stack cooling (blank side)', 'Stack cooling (blow side)',
		'Take out arm', 'TCS', 'Trough / deflector', 'Vacuum pump', 'Vertiflow', 'Swabbing robot (YC4)'
	],
	WARE_HANDLING: [
		'Cross conveyor', 'E-pusher / flex pusher', 'HEC', 'HEWR', 'Lehr', 'Machine conveyor', 'Stacker', 'Transfer wheel'
	],
	OTHERS: [
		'Control panel (Flexis)', 'Electrical controls', 'Low air pressure', 'Normal stop', 'Power failure'
	]
};

const SWAB_ITEMS = ['Extra Small', 'Small', 'Medium', 'Large', 'TC100'];

// Machine audit checklist (from the Machine Audit form).
// condition: 'O' = good, 'X' = bad, 'NC' = needs check-up, '' = not rated yet
const AUDIT_CONDITIONS = ['', 'O', 'X', 'NC'];
const AUDIT_TEMPLATE = [
	{ section: 'Forehearth & feeder', group: 'Forehearth', items: ['Roofing / Dampers', 'Heat Recovery System', 'Burners', 'Peepholes', 'Combustion Filters', 'Cooling Filters', 'Blowers', 'Purged Air System'] },
	{ section: 'Forehearth & feeder', group: 'Feeder', items: ['Spout/Feeder Mechanism', 'Revolving Tube Mechanism', 'Shear Spray', 'Interceptor Pad', 'Scoop Hose', 'Oil Leak', 'Cleanliness'] },
	{ section: 'IS machine', group: '', items: ['Regulators', 'Pressure Gauges', 'Settle Blow', 'Final Blow Hose', 'Finish Cooling Hose', 'Machine Conveyor Belt/Rollers', 'Pocket Air', 'Machine Dead Plate', 'Ladder', 'Mechanism Condition', 'Oil Leak', 'Cleanliness', 'Cushion Oil System', 'Pilot Air Filtration System', 'Swabbing Robot', 'TCS'] },
	{ section: 'Ware handling unit & annealing lehr', group: '', items: ['Transfer Wheel', 'Transfer Wheel Transfer Plate', 'Idle End Rollers', 'Cross Conveyor Transfer Plates', 'Cross Conveyor Drive Rollers', 'Stacker', 'Lehr Belt', 'Oil Leak', 'Cleanliness'] }
];

// Defaults for a month that has no saved settings yet. YC Team D keeps the names from its Summary report.
function reportDefaults(teamKey) {
	const [area, team] = teamKey.split('-');
	const base = {
		effTarget: 94.5,
		to: '',
		from: `Glass Forming – ${area} TEAM ${team}`,
		preparedBy: { name: '', title: 'Assistant Team Leader' },
		checkedBy: { name: '', title: 'Team Leader' }
	};
	if (teamKey === 'YC-D') {
		base.to = 'ENGR. GERALD F. VALDERAMA';
		base.preparedBy.name = 'Bader C. Lorenzo';
		base.checkedBy.name = 'Ron Christopher B. Martinez';
	}
	return base;
}

module.exports = {
	ROLES, AREAS, TEAMS, LINES, ALL_LINES, linesFor, teamKeyOf, TEAM_KEY_RE, LEAVE_CODES, DOWNTIME_GROUPS, DOWNTIME_ITEMS, SWAB_ITEMS,
	AUDIT_CONDITIONS, AUDIT_TEMPLATE, reportDefaults
};
