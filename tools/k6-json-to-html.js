#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const inFile = process.argv[2] || 'out.json';
const outFile = process.argv[3] || path.join('test', 'k6', 'report.html');

function safeParseLastJson(content) {
	// k6 --out json writes one JSON object per line (NDJSON); pick last valid JSON object
	const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
	for (let i = lines.length - 1; i >= 0; i--) {
		const l = lines[i];
		try {
			return JSON.parse(l);
		} catch (e) {
			// try earlier line
		}
	}
	// fallback: try parse whole content
	try { return JSON.parse(content); } catch (e) { return null; }
}

function metricRow(name, m) {
	const values = m && m.values ? m.values : {};
	const p95 = values['p(95)'] !== undefined ? values['p(95)'] : '';
	const avg = values.avg !== undefined ? values.avg : '';
	const min = values.min !== undefined ? values.min : '';
	const max = values.max !== undefined ? values.max : '';
	const count = values.count !== undefined ? values.count : '';
	return `<tr><td>${name}</td><td>${m.type}</td><td>${count}</td><td>${min}</td><td>${max}</td><td>${avg}</td><td>${p95}</td></tr>`;
}

try {
	const content = fs.readFileSync(inFile, 'utf8');
	const obj = safeParseLastJson(content);
	if (!obj) {
		console.error('Could not parse k6 JSON from', inFile);
		process.exit(2);
	}

	const metrics = obj.metrics || {};
	const checks = obj.checks || {};

	let rows = '';
	Object.keys(metrics).forEach(k => {
		rows += metricRow(k, metrics[k]);
	});

	let checksHtml = '';
	if (checks && typeof checks === 'object') {
		checksHtml = '<ul>' + Object.keys(checks).map(k => `<li>${k}: ${checks[k]}</li>`).join('') + '</ul>';
	}

	const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>k6 report</title>
<style>body{font-family:Arial,Helvetica,sans-serif}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4f4f4}</style>
</head><body>
<h1>k6 report</h1>
<h2>Metrics</h2>
<table>
<thead><tr><th>metric</th><th>type</th><th>count</th><th>min(ms)</th><th>max(ms)</th><th>avg(ms)</th><th>p95(ms)</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
<h2>Checks</h2>
${checksHtml}
<p>Generated from: ${inFile}</p>
</body></html>`;

	fs.mkdirSync(path.dirname(outFile), { recursive: true });
	fs.writeFileSync(outFile, html, 'utf8');
	console.log('Wrote report to', outFile);
} catch (err) {
	console.error('Error generating report:', err && err.message ? err.message : err);
	process.exit(1);
}
