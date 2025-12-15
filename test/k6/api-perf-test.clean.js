import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import faker from 'https://jslib.k6.io/faker/1.0.0/faker.min.js';
import { options } from '../../k6/options.js';

// --- Metrics ---
const loginTrend = new Trend('login_duration');
const registerTrend = new Trend('register_duration');
const progressTrend = new Trend('progress_duration');
const errors = new Rate('errors_rate');

// Load data-driven CSV (name,email,password)
const csv = open('./data/students.csv');
const lines = csv.split('\n').filter(l => l.trim() !== '');
const header = lines.shift();

function parseRow(i) {
  const cols = lines[i % lines.length].split(',');
  return { name: cols[0], email: cols[1], password: cols[2] };
}

// Helper to get base URL from env
function baseUrl() {
  return __ENV.BASE_URL || 'http://localhost:3000';
}

// Re-usable request helpers
function registerStudent(student) {
  const url = `${baseUrl()}/students/register`;
  const payload = JSON.stringify(student);
  const params = { headers: { 'Content-Type': 'application/json' } };
  const res = http.post(url, payload, params);
  registerTrend.add(res.timings.duration);
  const ok = check(res, {
    'register status 201 or 400 (exists)': (r) => r.status === 201 || r.status === 400,
  });
  if (!ok) errors.add(1);
  return res;
}

function loginStudent(email, password) {
  const url = `${baseUrl()}/students/login`;
  const payload = JSON.stringify({ email, password });
  const params = { headers: { 'Content-Type': 'application/json' } };
  const res = http.post(url, payload, params);
  loginTrend.add(res.timings.duration);
  const ok = check(res, {
    'student login 200': (r) => r.status === 200,
    'student login has token': (r) => !!(r.json && r.json().token),
  });
  if (!ok) errors.add(1);
  return res;
}

function loginInstructor(email, password) {
  const url = `${baseUrl()}/instructors/login`;
  const payload = JSON.stringify({ email, password });
  const params = { headers: { 'Content-Type': 'application/json' } };
  const res = http.post(url, payload, params);
  loginTrend.add(res.timings.duration);
  const ok = check(res, {
    'instructor login 200': (r) => r.status === 200,
    'instructor login has token': (r) => !!(r.json && r.json().token),
  });
  if (!ok) errors.add(1);
  return res;
}

function addProgress(instructorToken, studentId, lessonId) {
  const url = `${baseUrl()}/progress`;
  const payload = JSON.stringify({ studentId, lessonId });
  const params = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${instructorToken}` } };
  const res = http.post(url, payload, params);
  progressTrend.add(res.timings.duration);
  const ok = check(res, {
    'add progress 201 or 404': (r) => r.status === 201 || r.status === 404,
  });
  if (!ok) errors.add(1);
  return res;
}

// Setup: create an instructor and a lesson to use during the test
export function setup() {
  const base = baseUrl();
  const instrEmail = __ENV.INSTRUCTOR_EMAIL || `instr+${Math.floor(Math.random() * 10000)}@example.com`;
  const instrPwd = __ENV.INSTRUCTOR_PASSWORD || 'instructorpass';
  http.post(`${base}/instructors/register`, JSON.stringify({ name: 'Perf Instr', email: instrEmail, password: instrPwd }), { headers: { 'Content-Type': 'application/json' } });
  const loginRes = loginInstructor(instrEmail, instrPwd);
  const token = (loginRes && loginRes.json) ? loginRes.json().token : null;

  const lessonRes = http.post(`${base}/lessons`, JSON.stringify({ title: 'K6 Lesson', description: 'Created for performance test' }), { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
  let lessonId = 1;
  try {
    const j = lessonRes.json();
    lessonId = j && j.id ? j.id : 1;
  } catch (e) {
    // ignore
  }

  return { base, instructorToken: token, lessonId };
}

export default function (data) {
  const row = parseRow(__ITER || 0);

  group('student lifecycle', function () {
    const randomName = faker.name.findName();
    const student = { name: row.name || randomName, email: row.email || `user+${__VU}_${__ITER}@example.com`, password: row.password || 'pass123' };

    const reg = registerStudent(student);
    let studentId = null;
    try {
      const json = reg.json();
      studentId = json && json.id ? json.id : null;
    } catch (e) {}

    const loginRes = loginStudent(student.email, student.password);
    let studentToken = null;
    try {
      studentToken = loginRes.json().token;
    } catch (e) {}

    const instructorToken = data.instructorToken;

    group('instructor actions', function () {
      if (studentId) {
        addProgress(instructorToken, studentId, data.lessonId);
      }

      const res = http.get(`${baseUrl()}/students`, { headers: { Authorization: `Bearer ${instructorToken}` } });
      check(res, { 'get students 200': (r) => r.status === 200 });
    });

    sleep(1);
  });
}
