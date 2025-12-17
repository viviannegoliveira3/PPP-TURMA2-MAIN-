Testes de performance k6 (localizados em `test/k6`)

Este README descreve onde no código cada um dos conceitos solicitados está implementado.

Sumário rápido (arquivos relevantes)
- `test/k6/api-perf-test.js` — script k6 principal (options, helpers, trends, groups, CSV, setup).
- `test/k6/data/students.csv` — dados para data-driven testing.
- `tools/k6-json-to-html.js` — conversor simples de JSON k6 para HTML (tenta ler o objeto agregado quando presente).
- `tools/parse-k6-json.js` — utilitário que agrega pontos NDJSON e pode gerar um relatório HTML quando o resumo agregado não está presente.

Detalhamento por conceito (trechos e linhas em `test/k6/api-perf-test.js`)

- Thresholds

  Trecho (linhas 10–16):

  ```javascript
  // linhas 10-16
  export const options = {
    vus: 2,
    duration: '15s',
    thresholds: {
      'errors_rate': ['rate<0.1']
    }
  };
  ```

- Checks

  Exemplos (linhas 46–51 e 60–63):

  ```javascript
Source: https://github.com/juliodelimas/ppp-turma2/blob/main/test/k6/api-perf-test.js#L10-L16
  // linhas 46-51 (registerStudent)
  registerTrend.add(res.timings.duration);
  const ok = check(res, {
    'register status 201 or 400 (exists)': (r) => r.status === 201 || r.status === 400,
  });
  if (!ok) errors.add(1);
  ```

  ```javascript
  // linhas 60-63 (loginStudent checks)
  const ok = check(res, {
    'student login 200': (r) => r.status === 200,
Source: https://github.com/juliodelimas/ppp-turma2/blob/main/test/k6/api-perf-test.js#L46-L51
    'student login has token': (r) => !!(r.json && r.json().token),
  });
  ```

- Helpers

  Funções reutilizáveis definidas no topo do script:
Source: https://github.com/juliodelimas/ppp-turma2/blob/main/test/k6/api-perf-test.js#L60-L63

  ```javascript
  // linhas 5-9 (randomName)
  function randomName() { /* gera nomes aleatórios */ }

  // linhas 41-52 (registerStudent)
  function registerStudent(student) { /* ... */ }

  // linhas 54-66 (loginStudent)
  function loginStudent(email, password) { /* ... */ }

  // linhas 82-93 (addProgress)
  function addProgress(instructorToken, studentId, lessonId) { /* ... */ }
  ```

- Trends

Source: https://github.com/juliodelimas/ppp-turma2/blob/main/test/k6/api-perf-test.js#L5-L9
  Declaração de métricas custom (linhas 19–23):

  ```javascript
  // linhas 19-23
  const loginTrend = new Trend('login_duration');
  const registerTrend = new Trend('register_duration');
  const progressTrend = new Trend('progress_duration');
  const errors = new Rate('errors_rate');
  ```

- Faker (geração local de dados únicos)
Source: https://github.com/juliodelimas/ppp-turma2/blob/main/test/k6/api-perf-test.js#L19-L23

  Para execução local o teste usa um gerador simples (evita dependência de CDN):

  ```javascript
  // linhas 4-9 (gerador local)
  function randomName() { /* gera nomes aleatórios para execução local */ }
  ```

Source: https://github.com/juliodelimas/ppp-turma2/blob/main/test/k6/api-perf-test.js#L4-L9
- Variável de Ambiente

  O helper `baseUrl()` e o `setup()` usam `__ENV` (linhas 35–38 e 98–100):

  ```javascript
  // linhas 35-38
  function baseUrl() {
    return __ENV.BASE_URL || 'http://localhost:3000';
  }

Source: https://github.com/juliodelimas/ppp-turma2/blob/main/test/k6/api-perf-test.js#L35-L38
  // linhas 98-100 (setup usa __ENV para instruidor)
  const instrEmail = __ENV.INSTRUCTOR_EMAIL || `instr+${Math.floor(Math.random() * 10000)}@example.com`;
  const instrPwd = __ENV.INSTRUCTOR_PASSWORD || 'instructorpass';
  ```

Source: https://github.com/juliodelimas/ppp-turma2/blob/main/test/k6/api-perf-test.js#L98-L100
- Stages

  O arquivo traz um preset local (`vus`/`duration`) nas linhas 11–13; para execuções reais em CI prefira usar `options.stages` ou passar `ENV_STAGES` via `run-k6.ps1`.

  ```javascript
  // linhas 11-13 (preset local)
  export const options = { vus: 2, duration: '15s' };
  ```
Source: https://github.com/juliodelimas/ppp-turma2/blob/main/test/k6/api-perf-test.js#L11-L13

- Reaproveitamento de Resposta

  O `setup()` cria/inicializa objetos reutilizáveis (instructor token e lessonId) e os retorna para as VUs — linhas ~101–113:

  ```javascript
  // linhas 101-104 e 113 (setup retorna token e lessonId)
  const loginRes = loginInstructor(instrEmail, instrPwd);
  const token = (loginRes && loginRes.json) ? loginRes.json().token : null;
  // ... cria lesson ...
  return { base, instructorToken: token, lessonId };
Source: https://github.com/juliodelimas/ppp-turma2/blob/main/test/k6/api-perf-test.js#L101-L113
  ```

- Uso de Token de Autenticação

  Os headers com `Authorization: Bearer <token>` aparecem nas chamadas protegidas (ex.: addProgress linha ~85 e GET /students linha ~143):

  ```javascript
  // linha 85 (addProgress headers)
Source: https://github.com/juliodelimas/ppp-turma2/blob/main/test/k6/api-perf-test.js#L85-L85
  const params = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${instructorToken}` } };

  // linha 143 (GET /students com Authorization)
  http.get(`${baseUrl()}/students`, { headers: { Authorization: `Bearer ${instructorToken}` } });
Source: https://github.com/juliodelimas/ppp-turma2/blob/main/test/k6/api-perf-test.js#L143-L143
  ```

- Data-Driven Testing

  Leitura do CSV e função `parseRow` (linhas 25–33):

  ```javascript
  // linhas 25-33
  const csv = open('./data/students.csv');
  const lines = csv.split('\n').filter(l => l.trim() !== '');
Source: https://github.com/juliodelimas/ppp-turma2/blob/main/test/k6/api-perf-test.js#L25-L33
  function parseRow(i) { const cols = lines[i % lines.length].split(','); return { name: cols[0], email: cols[1], password: cols[2] }; }
  ```

- Groups

  O script usa `group()` para organizar o fluxo (linhas ~119 e ~138):

  ```javascript
  // linhas 119 e 138
Source: https://github.com/juliodelimas/ppp-turma2/blob/main/test/k6/api-perf-test.js#L119-L138
  group('student lifecycle', function () { /* ... */ });
  group('instructor actions', function () { /* ... */ });
  ```

Como executar

1. Inicie a API em outra janela:

```powershell
node app.js
```

2. Execute o teste k6 (exemplo local):

```powershell

```
k6 run --out json=out.json test/k6/api-perf-test.js --env BASE_URL=http://localhost:3000
3. Gere o relatório HTML:

```powershell
node tools/parse-k6-json.js out.json test/k6/report.html
# ou (se o k6 já gerou o agregado):
node tools/k6-json-to-html.js out.json test/k6/report.html
```

Observações

- O `tools/k6-json-to-html.js` tenta ler o bloco agregado do JSON gerado pelo k6; quando esse bloco não está presente (você apenas tem pontos NDJSON) o `tools/parse-k6-json.js` pode agregar e gerar um HTML simples.
- Para relatórios mais completos/visuais, recomendo exportar o k6 para Influx/Grafana ou usar um repositório de métricas dedicado.
