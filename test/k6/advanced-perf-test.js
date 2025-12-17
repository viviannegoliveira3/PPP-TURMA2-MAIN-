import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';

// --- 1. Options (Stages & Thresholds) ---
// Simulates a load profile: ramp up to 10 VUs, hold, then ramp down.
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users over 30 seconds
    { duration: '1m', target: 10 },  // Stay at 10 users for 1 minute
    { duration: '10s', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    'http_req_failed': ['rate<0.01'], // Fail if more than 1% of requests fail
    'http_req_duration': ['p(95)<500'], // 95% of requests must complete below 500ms
    'login_duration': ['p(95)<400'], // 95% of logins should be below 400ms
    'register_duration': ['p(95)<400'],
    'checks': ['rate>0.99'], // More than 99% of checks must pass
  },
};

// --- 2. Custom Metrics (Trends) ---
const loginTrend = new Trend('login_duration');
const registerTrend = new Trend('register_duration');
const getProgressTrend = new Trend('get_progress_duration');
const errorRate = new Rate('error_rate');
const successCounter = new Counter('successful_logins');

// --- 3. Data-Driven Testing (SharedArray) ---
// Load data from students.csv. SharedArray is memory-efficient.
const studentData = new SharedArray('students', function () {
  // k6 requires reading the file and returning the parsed data.
  // The file is read once and shared among all VUs.
  return papaparse.parse(open('./data/students.csv'), { header: true }).data;
});

// --- 4. Helper Functions ---
// Helper to get base URL from an environment variable for flexibility
function getBaseUrl() {
  return __ENV.BASE_URL || 'http://localhost:3000';
}

// --- 5. Setup Function (Executes once before the test) ---
// Use this to prepare test data, like creating a single instructor and lesson.
export function setup() {
  console.log('Setting up the test environment...');
  const baseUrl = getBaseUrl();
  // Use environment variables for credentials or default to random
  const instructorEmail = __ENV.INSTRUCTOR_EMAIL || `instructor_${randomString(5)}@example.com`;
  const instructorPassword = __ENV.INSTRUCTOR_PASSWORD || 'supersecret';

  // Register a new instructor for the test run
  let registerRes = http.post(`${baseUrl}/instructors/register`, JSON.stringify({
    name: 'Test Instructor',
    email: instructorEmail,
    password: instructorPassword,
  }), { headers: { 'Content-Type': 'application/json' } });

  check(registerRes, { 'instructor registered successfully': (r) => r.status === 201 });

  // Login as the instructor to get an auth token
  let loginRes = http.post(`${baseUrl}/instructors/login`, JSON.stringify({
    email: instructorEmail,
    password: instructorPassword,
  }), { headers: { 'Content-Type': 'application/json' } });

  const authToken = loginRes.json('token');
  check(loginRes, { 'instructor logged in successfully': (r) => r.status === 200 && authToken });

  // Create a global lesson to be used by all VUs
  const lessonPayload = {
      title: `K6 Test Lesson - ${randomString(5)}`,
      description: 'A lesson created for performance testing.'
  };
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` };
  let lessonRes = http.post(`${baseUrl}/lessons`, JSON.stringify(lessonPayload), { headers });

  const lessonId = lessonRes.json('id');
  check(lessonRes, { 'lesson created successfully': (r) => r.status === 201 && lessonId });
  
  console.log(`Setup complete. Instructor Token and Lesson ID (${lessonId}) are ready.`);
  // This data is passed to the default function for each VU
  return { instructorToken: authToken, lessonId: lessonId };
}

// --- 6. Main VU Code (The test itself) ---
export default function (data) {
  const baseUrl = getBaseUrl();
  const vuId = __VU;
  const iteration = __ITER;

  // Pick a student from the shared data array
  const student = studentData[iteration % studentData.length];
  
  // Use Faker-like random data for students not in the CSV, ensuring unique users
  const studentEmail = student.email ? student.email.replace('@', `+${vuId}${iteration}@`) : `student_${vuId}_${iteration}@example.com`;
  const studentPassword = student.password || 'password123';
  const studentName = student.name || `Test Student ${vuId}-${iteration}`;

  let studentAuthToken = '';
  let studentId = '';
  
  group('Student Authentication', function () {
    // Register a new student
    const registerPayload = JSON.stringify({
        name: studentName,
        email: studentEmail,
        password: studentPassword
    });
    const headers = { 'Content-Type': 'application/json' };
    
    const registerRes = http.post(`${baseUrl}/students/register`, registerPayload, { headers });
    registerTrend.add(registerRes.timings.duration);
    const registerCheck = check(registerRes, {
        'student registration returns 201': (r) => r.status === 201,
    });
    errorRate.add(!registerCheck);
    if(registerCheck){
        studentId = registerRes.json('id');
    }
    
    sleep(1);

    // Login with the new student
    const loginPayload = JSON.stringify({ email: studentEmail, password: studentPassword });
    const loginRes = http.post(`${baseUrl}/students/login`, loginPayload, { headers });

    loginTrend.add(loginRes.timings.duration);
    const loginCheck = check(loginRes, {
        'student login returns 200': (r) => r.status === 200,
        'student login provides token': (r) => r.json('token') !== '',
    });

    errorRate.add(!loginCheck);
    if (loginCheck) {
        studentAuthToken = loginRes.json('token');
        successCounter.add(1);
    }
  });

  sleep(1);

  if (studentAuthToken && studentId) {
      group('Student Progression', function () {
        // As an instructor, mark progress for the student (Response Reuse from setup)
        const progressPayload = JSON.stringify({ studentId, lessonId: data.lessonId });
        const instructorHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.instructorToken}` };

        const addProgressRes = http.post(`${baseUrl}/progress`, progressPayload, { headers: instructorHeaders });
        const progressCheck = check(addProgressRes, {
            'adding progress returns 201': (r) => r.status === 201,
        });
        errorRate.add(!progressCheck);

        sleep(1);

        // As the student, fetch my own progress (Response Reuse from login)
        const studentHeaders = { 'Authorization': `Bearer ${studentAuthToken}` };
        const getProgressRes = http.get(`${baseUrl}/students/progress/${studentId}`, { headers: studentHeaders });
        
        getProgressTrend.add(getProgressRes.timings.duration);
        const getProgressCheck = check(getProgressRes, {
            'get progress returns 200': (r) => r.status === 200,
            'progress data is an array': (r) => Array.isArray(r.json()),
        });
        errorRate.add(!getProgressCheck);
    });
  }
  
  sleep(2);
}

// --- 7. Teardown Function (Executes once after the test) ---
export function teardown(data) {
  console.log('Test finished. Tearing down environment.');
  // Here you could add logic to clean up created data, e.g., delete the instructor or lessons.
  // For example:
  // const res = http.del(`${getBaseUrl()}/lessons/${data.lessonId}`, null, { headers: { 'Authorization': `Bearer ${data.instructorToken}` } });
  // check(res, { 'cleanup: lesson deleted': (r) => r.status === 204 });
}
