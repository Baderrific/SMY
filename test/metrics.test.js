// Checks that the dashboard math reproduces the official January 2026 report.
// Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const m = require('../services/metrics');
const d = require('../seed/january-2026.json');

test('team efficiency and line averages match the Summary (93.01%)', () => {
	const r = m.efficiency(d.efficiency, { effTarget: d.effTarget, daysOverride: d.daysOverride });
	assert.deepStrictEqual(Object.values(r.lines).map(l => l.avg), [95.1, 92.28, 92.93, 91.73]);
	assert.strictEqual(r.teamAvg, 93.01);
});

test('stripping matches the Summary (0.67%)', () => {
	const r = m.stripping(d.stripping);
	assert.deepStrictEqual(Object.values(r.lines).map(l => Math.round(l.avg * 100) / 100), [0.44, 0.87, 0.57, 0.81]);
	assert.strictEqual(Math.round(r.teamAvg * 100) / 100, 0.67);
});

test('downtime matches the Summary (1005 min)', () => {
	const r = m.downtime(d.downtime);
	assert.strictEqual(r.total, 1005);
	assert.deepStrictEqual(r.byLine, { YC1: 185, YC2: 310, YC3: 375, YC4: 135 });
	assert.strictEqual(r.byGroup.FEEDER.pct, 14.43);
});

test('leaves and overtime match (16 VL, 5 SL, 10 AWP, 9 HL, 69.7 h)', () => {
	const r = m.personnel(d.personnel);
	assert.deepStrictEqual([r.leaveTotals.VL, r.leaveTotals.SL, r.leaveTotals.AWP, r.leaveTotals.HL], [16, 5, 10, 9]);
	assert.strictEqual(r.otTotal, 696.5);
	assert.strictEqual(r.otAvg, 69.65);
});

test('loss codes are read from the efficiency remarks', () => {
	assert.deepStrictEqual(m.parseLossCodes('STRIP 6.18 / SGAP 3.08 / NORMAL OPERATION'), [{ code: 'STRIP', value: 6.18 }, { code: 'SGAP', value: 3.08 }]);
});

test('efficiency lost per defect code is an average percent over the counted days', () => {
	const r = m.efficiency(d.efficiency, { effTarget: d.effTarget, daysOverride: d.daysOverride });
	const flexc = r.lossByCode.find(l => l.code === 'FLEXC');
	assert.strictEqual(flexc.avg, Math.round(flexc.total / r.lossEntries * 100) / 100);
	assert.strictEqual(r.lossEntries, d.efficiency.filter(e => !e.excludeFromAverage).length);
});

test('stripping defects are also ranked for each line', () => {
	const r = m.stripping(d.stripping);
	assert.deepStrictEqual(Object.keys(r.defectsByLine), ['YC1', 'YC2', 'YC3', 'YC4']);
	const count = Object.values(r.defectsByLine).flat().reduce((a, x) => a + x.count, 0);
	assert.strictEqual(count, d.stripping.length);
});

test('other areas use their own lines (YA1-YA4)', () => {
	const lines = ['YA1', 'YA2', 'YA3', 'YA4'];
	const r = m.efficiency([{ date: '2026-10-01', line: 'YA2', efficiency: 60, remarks: '', excludeFromAverage: false }], { effTarget: 94.5 }, lines);
	assert.deepStrictEqual(Object.keys(r.lines), lines);
	assert.strictEqual(r.lines.YA2.avg, 60);
	assert.strictEqual(r.teamAvg, 60);
});
