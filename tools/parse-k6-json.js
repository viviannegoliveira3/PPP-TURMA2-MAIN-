#!/usr/bin/env node
const fs = require('fs');
const readline = require('readline');
const inFile = process.argv[2] || 'out.json';
const outFile = process.argv[3] || null; // if provided, write an HTML report

if (!fs.existsSync(inFile)) {
  console.error('File not found:', inFile);
  process.exit(2);
}

const durValues = [];
let reqCount = 0;
let failedCount = 0;
let firstTime = null;
let lastTime = null;
const checks = {};

const rl = readline.createInterface({ input: fs.createReadStream(inFile), crlfDelay: Infinity });
rl.on('line', (line) => {
  line = line.trim();
  if (!line) return;
  try {
    const obj = JSON.parse(line);
    if (obj.metric === 'http_req_duration' && obj.type === 'Point' && obj.data && typeof obj.data.value === 'number') {
      durValues.push(obj.data.value);
      const t = new Date(obj.data.time).getTime();
      if (!firstTime || t < firstTime) firstTime = t;
      if (!lastTime || t > lastTime) lastTime = t;
    }
    if (obj.metric === 'http_reqs' && obj.type === 'Point') {
      reqCount += typeof obj.data.value === 'number' ? obj.data.value : 1;
      const t = new Date(obj.data.time).getTime();
      if (!firstTime || t < firstTime) firstTime = t;
      if (!lastTime || t > lastTime) lastTime = t;
    }
    if (obj.metric === 'http_req_failed' && obj.type === 'Point') {
      failedCount += typeof obj.data.value === 'number' ? obj.data.value : 0;
    }
    if (obj.metric === 'checks' && obj.type === 'Point') {
      const checkName = obj.data && obj.data.tags && obj.data.tags.check ? obj.data.tags.check : 'unknown';
      const val = obj.data && typeof obj.data.value === 'number' ? obj.data.value : 0;
      checks[checkName] = (checks[checkName] || 0) + val;
    }
    // Also check for final summary object which may contain metrics/checks
    if (obj.metrics && obj.checks) {
      // prefer final summary if present
      rl.close();
      parseSummaryObject(obj);
    }
  } catch (e) {
    // ignore parse errors
  }
});

function parseSummaryObject(obj) {
  // obj.metrics contains aggregated metrics
  const out = {};
  for (const k of Object.keys(obj.metrics)) {
    const m = obj.metrics[k];
    const vals = m && m.values ? m.values : {};
    out[k] = vals;
  }
  const checksObj = obj.checks || {};
  printResultsFromSummary(out, checksObj);
}

function printResultsFromSummary(metricsObj, checksObj) {
  const p95 = (metricsObj['http_req_duration'] && metricsObj['http_req_duration']['p(95)']) || (metricsObj['http_req_duration{expected_response:true}'] && metricsObj['http_req_duration{expected_response:true}']['p(95)']) || null;
  const avg = (metricsObj['http_req_duration'] && metricsObj['http_req_duration'].avg) || null;
  const count = (metricsObj['http_reqs'] && metricsObj['http_reqs'].count) || reqCount || null;
  const failedRate = (metricsObj['http_req_failed'] && metricsObj['http_req_failed'].rate) || null;
  console.log('Summary from final aggregated object (if present):');
  console.log('p95 (ms):', p95);
  console.log('avg (ms):', avg);
  console.log('total requests:', count);
  console.log('http_req_failed (rate):', failedRate);
  console.log('checks:', checksObj);
  process.exit(0);
}

rl.on('close', () => {
  if (Object.keys(checks).length === 0 && durValues.length === 0 && reqCount === 0) {
    console.log('No metric points parsed from out.json. File may not contain aggregated summary object.');
    process.exit(0);
  }

  // compute stats from collected points
  durValues.sort((a,b)=>a-b);
  const count = durValues.length;
  const sum = durValues.reduce((a,b)=>a+b,0);
  const avg = count ? sum / count : 0;
  const min = count ? durValues[0] : 0;
  const max = count ? durValues[count-1] : 0;
  const p95 = count ? durValues[Math.max(0, Math.floor(0.95*count)-1)] : 0;
  const durationSec = firstTime && lastTime ? Math.max(1, (lastTime - firstTime)/1000) : 1;
  const throughput = reqCount / durationSec;
  const summary = {
    p95: Number(p95.toFixed(3)),
    avg: Number(avg.toFixed(3)),
    min: Number(min.toFixed(3)),
    max: Number(max.toFixed(3)),
    total_requests: reqCount,
    duration_s: Number(durationSec.toFixed(2)),
    throughput_rps: Number(throughput.toFixed(3)),
    failed_requests: failedCount,
    checks: checks
  };

  if (outFile) {
    // write a simple HTML report
    const fs = require('fs');
    const path = require('path');
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>k6 execution report</title>
<style>body{font-family:Arial,Helvetica,sans-serif}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4f4f4}</style>
</head><body>
<h1>k6 execution report</h1>
<h2>Summary</h2>
<table>
<thead><tr><th>metric</th><th>value</th></tr></thead>
<tbody>
<tr><td>p95 (ms)</td><td>${summary.p95}</td></tr>
<tr><td>avg (ms)</td><td>${summary.avg}</td></tr>
<tr><td>min (ms)</td><td>${summary.min}</td></tr>
<tr><td>max (ms)</td><td>${summary.max}</td></tr>
<tr><td>total requests</td><td>${summary.total_requests}</td></tr>
<tr><td>duration (s)</td><td>${summary.duration_s}</td></tr>
<tr><td>throughput (reqs/s)</td><td>${summary.throughput_rps}</td></tr>
<tr><td>failed requests</td><td>${summary.failed_requests}</td></tr>
</tbody>
</table>
<h2>Checks</h2>
<ul>
${Object.keys(summary.checks).map(k=>`<li>${k}: ${summary.checks[k]}</li>`).join('\n')}
</ul>
<p>Generated from: ${inFile}</p>
</body></html>`;

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, html, 'utf8');
    console.log('Wrote HTML report to', outFile);
    process.exit(0);
  }

  // otherwise print to console
  console.log('Computed summary from raw points:');
  console.log('p95 (ms):', summary.p95);
  console.log('avg (ms):', summary.avg);
  console.log('min (ms):', summary.min);
  console.log('max (ms):', summary.max);
  console.log('total requests:', summary.total_requests);
  console.log('duration (s):', summary.duration_s);
  console.log('throughput (reqs/s):', summary.throughput_rps);
  console.log('failed requests (count):', summary.failed_requests);
  console.log('checks summary (counts of true occurrences):', summary.checks);
  process.exit(0);
});
