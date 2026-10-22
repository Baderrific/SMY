// All the numbers on the dashboards are calculated here (pure functions, no database).
// The rules follow the team's own Excel sheets:
//  - Efficiency line average = sum of counted days / counted days (job-change days are not counted)
//  - Stripping line average  = plain average of the % strip rows
//  - Team efficiency / team stripping = average of the line averages
//  - Average overtime = total hours / number of members
const { LINES: DEFAULT_LINES, LEAVE_CODES, DOWNTIME_GROUPS } = require('../config/constants');

const round = (n, d = 2) => (n === null || n === undefined || Number.isNaN(n)) ? null : Math.round(n * 10 ** d) / 10 ** d;
const sum = (list) => list.reduce((a, b) => a + b, 0);
const mean = (list) => list.length ? sum(list) / list.length : null;
const sortBy = (list, ...keys) => [...list].sort((a, b) => {
	for (const k of keys) { if (a[k] < b[k]) return -1; if (a[k] > b[k]) return 1; }
	return 0;
});

// Remarks look like "STRIP 6.18 / SGAP 3.08 / FLEXC 1.60". Each CODE number is a loss in efficiency points
function parseLossCodes(remarks) {
	return String(remarks || '').split('/').map(part => part.trim().match(/^([A-Za-z]+)\s+(\d+(?:\.\d+)?)$/)).filter(Boolean).map(m => ({ code: m[1].toUpperCase(), value: Number(m[2]) }));
}

function efficiency(entries, meta = {}, LINES = DEFAULT_LINES) {
	const target = meta.effTarget ?? 94.5;
	const override = meta.daysOverride || {};
	const dates = [...new Set(entries.map(e => e.date))].sort();
	const lines = {};
	const lineAvgs = [];

	for (const line of LINES) {
		const list = sortBy(entries.filter(e => e.line === line), 'date');
		const counted = list.filter(e => !e.excludeFromAverage);
		const divisor = override[line] || counted.length;
		const avgRaw = divisor ? sum(counted.map(e => e.efficiency)) / divisor : null;
		if (avgRaw !== null) lineAvgs.push(avgRaw);
		lines[line] = {
			avg: round(avgRaw), days: list.length, counted: counted.length, excluded: list.length - counted.length,
			divisor: divisor || null, overridden: Boolean(override[line]),
			belowTarget: counted.filter(e => e.efficiency < target).length,
			best: counted.length ? Math.max(...counted.map(e => e.efficiency)) : null,
			lowest: counted.length ? Math.min(...counted.map(e => e.efficiency)) : null,
			// one value per date (null when the line did not run that day), for the line chart
			series: dates.map(d => { const hit = list.find(e => e.date === d); return hit ? hit.efficiency : null; })
		};
	}

	// Loss codes come from the remarks of the counted days only (same days as the efficiency average).
	// avg = the code's loss added up / number of counted line-days, in efficiency percent.
	const countedEntries = entries.filter(e => !e.excludeFromAverage);
	const loss = {};
	for (const e of countedEntries) {
		for (const { code, value } of parseLossCodes(e.remarks)) {
			loss[code] = loss[code] || { code, total: 0, count: 0 };
			loss[code].total += value; loss[code].count += 1;
		}
	}

	return {
		target, dates, lines, teamAvg: round(mean(lineAvgs)),
		lossEntries: countedEntries.length,
		lossByCode: Object.values(loss)
			.map(l => ({ ...l, total: round(l.total), avg: round(l.total / countedEntries.length) }))
			.sort((a, b) => b.total - a.total)
	};
}

// Defects ranked by how many times they happened: [{ defect, count, total }]
function rankDefects(list) {
	const defects = {};
	for (const e of list) {
		const key = e.defect.trim().toLowerCase();
		defects[key] = defects[key] || { defect: e.defect.trim(), count: 0, total: 0 };
		defects[key].count += 1; defects[key].total += e.percent;
	}
	return Object.values(defects).map(d => ({ ...d, total: round(d.total) })).sort((a, b) => b.count - a.count || b.total - a.total);
}

function stripping(entries, LINES = DEFAULT_LINES) {
	const dates = [...new Set(entries.map(e => e.date))].sort();
	const lines = {};
	const lineAvgs = [];

	for (const line of LINES) {
		const list = entries.filter(e => e.line === line);
		const avg = mean(list.map(e => e.percent));
		if (avg !== null) lineAvgs.push(avg);
		lines[line] = {
			avg: round(avg, 3), entries: list.length,
			// total % stripped per date for the chart
			series: dates.map(d => { const day = list.filter(e => e.date === d); return day.length ? round(sum(day.map(e => e.percent))) : null; })
		};
	}

	const defectsByLine = {};
	for (const line of LINES) defectsByLine[line] = rankDefects(entries.filter(e => e.line === line));

	return { dates, lines, teamAvg: round(mean(lineAvgs), 3), byDefect: rankDefects(entries), defectsByLine };
}

function downtime(entries, LINES = DEFAULT_LINES) {
	const total = sum(entries.map(e => e.minutes));
	const byLine = {}, byGroup = {}, byLineGroup = {};
	for (const line of LINES) {
		byLine[line] = sum(entries.filter(e => e.line === line).map(e => e.minutes));
		byLineGroup[line] = {};
		for (const g of Object.keys(DOWNTIME_GROUPS)) byLineGroup[line][g] = sum(entries.filter(e => e.line === line && e.group === g).map(e => e.minutes));
	}
	for (const g of Object.keys(DOWNTIME_GROUPS)) {
		const minutes = sum(entries.filter(e => e.group === g).map(e => e.minutes));
		byGroup[g] = { minutes, pct: total ? round(minutes / total * 100) : 0 };
	}
	const items = {};
	for (const e of entries) {
		const key = `${e.group}|${e.item}`;
		items[key] = items[key] || { group: e.group, item: e.item, minutes: 0 };
		items[key].minutes += e.minutes;
	}
	return { total, byLine, byGroup, byLineGroup, topItems: Object.values(items).sort((a, b) => b.minutes - a.minutes) };
}

function personnel(records) {
	const headcount = records.length;
	const leaveTotals = {};
	Object.keys(LEAVE_CODES).forEach(c => { leaveTotals[c] = sum(records.map(r => (r.leaves && r.leaves[c]) || 0)); });
	const members = records.map(r => ({
		_id: r._id, name: r.name, leaves: r.leaves || {},
		leaveTotal: sum(Object.keys(LEAVE_CODES).map(c => (r.leaves && r.leaves[c]) || 0)),
		otFirstHalf: r.otFirstHalf || 0, otSecondHalf: r.otSecondHalf || 0,
		otTotal: round((r.otFirstHalf || 0) + (r.otSecondHalf || 0), 1)
	}));
	const otTotal = sum(members.map(m => m.otTotal));
	return {
		headcount, leaveTotals, members, otTotal: round(otTotal, 1),
		otAvg: headcount ? round(otTotal / headcount) : null,
		firstHalfTotal: round(sum(members.map(m => m.otFirstHalf)), 1),
		secondHalfTotal: round(sum(members.map(m => m.otSecondHalf)), 1)
	};
}

function swabstick(records) {
	return { rows: records, consumedTotal: sum(records.filter(r => r.item !== 'TC100').map(r => r.consumed)) };
}

function audits(list, LINES = DEFAULT_LINES) {
	const lines = {};
	for (const line of LINES) {
		const a = list.find(x => x.line === line);
		if (!a) { lines[line] = { started: false, total: 0, rated: 0, good: 0, bad: 0, needsCheck: 0 }; continue; }
		const count = c => a.items.filter(i => i.condition === c).length;
		lines[line] = { started: true, total: a.items.length, rated: a.items.filter(i => i.condition).length, good: count('O'), bad: count('X'), needsCheck: count('NC') };
	}
	const all = Object.values(lines);
	return { lines, total: sum(all.map(l => l.total)), rated: sum(all.map(l => l.rated)), bad: sum(all.map(l => l.bad)), needsCheck: sum(all.map(l => l.needsCheck)) };
}

function withdrawals(entries) {
	const items = {};
	for (const e of entries) {
		const key = `${e.materialNo}|${e.name.toLowerCase()}`;
		items[key] = items[key] || { name: e.name, materialNo: e.materialNo, pcs: 0, count: 0 };
		items[key].pcs += e.pcs; items[key].count += 1;
	}
	const byItem = Object.values(items).sort((a, b) => b.pcs - a.pcs);
	return { records: entries.length, totalPcs: sum(entries.map(e => e.pcs)), distinctItems: byItem.length, byItem };
}

// One row per month of the year (the OT-EFF average sheet, plus stripping and downtime)
function yearly(year, perMonth) {
	const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
	const rows = months.map((label, i) => {
		const m = perMonth[`${year}-${String(i + 1).padStart(2, '0')}`] || {};
		return { period: `${year}-${String(i + 1).padStart(2, '0')}`, label, efficiency: m.efficiency ?? null, stripping: m.stripping ?? null, downtime: m.downtime ?? null, avgOT: m.avgOT ?? null };
	});
	const avgOf = key => round(mean(rows.map(r => r[key]).filter(v => v !== null)));
	return { year, rows, ytd: { efficiency: avgOf('efficiency'), stripping: round(mean(rows.map(r => r.stripping).filter(v => v !== null)), 3), downtime: sum(rows.map(r => r.downtime || 0)), avgOT: avgOf('avgOT') } };
}

module.exports = { efficiency, stripping, downtime, personnel, swabstick, audits, withdrawals, yearly, parseLossCodes, round };
