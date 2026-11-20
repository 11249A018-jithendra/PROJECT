const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Exercise the real controller against an in-memory Supabase boundary. The
// update predicates are applied at write time, including concurrent changes.
const setup = (status = 'Approved') => {
  const row = {
    _id: 'pass', student_id: 'student', status, pass_type: 'Outing',
    qr_token: 'qr', student: { assigned_warden: 'warden' },
    leave_datetime: new Date(Date.now() - 60000).toISOString(),
    return_datetime: new Date(Date.now() + 3600000).toISOString(),
  };
  const state = { row, beforeUpdate: null, logs: [] };
  const db = { from(table) {
    let updates, inserted;
    const filters = [];
    const execute = () => {
      if (table === 'outpass_scan_logs') {
        if (inserted) state.logs.push(inserted);
        return { data: null, error: null };
      }
      if (table !== 'outpasses') return { data: null, error: null };
      if (updates && state.beforeUpdate) state.beforeUpdate(row);
      const matches = filters.every(([key, value, negate]) => negate ? row[key] !== value : row[key] === value);
      if (!matches) return { data: null, error: null };
      if (updates) Object.assign(row, updates);
      return { data: { ...row }, error: null };
    };
    const q = {
      select() { return q; },
      eq(key, value) { filters.push([key, value, false]); return q; },
      neq(key, value) { filters.push([key, value, true]); return q; },
      update(values) { updates = values; return q; },
      insert(values) { inserted = values; return q; },
      limit() { return Promise.resolve({ data: [], error: null }); },
      single() { return Promise.resolve(execute()); },
      maybeSingle() { return Promise.resolve(execute()); },
      then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject); },
    };
    return q;
  } };
  const filename = path.resolve(__dirname, '../../controllers/outpassController.js');
  const realRequire = createRequire(filename);
  const context = {
    require: (id) => {
      if (id === '../supabase') return db;
      if (id === '../utils/attendanceAuto') return { markAbsentIfUnmarked: async () => {} };
      return realRequire(id);
    },
    module: { exports: {} }, console,
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return { controller: context.module.exports, state };
};

process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY ||= 'unit-test-key';

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});
const scan = async (controller, action) => {
  const res = response();
  await controller.scanQr({ body: { qr_token: 'qr', action }, user: { _id: 'guard' } }, res);
  return res;
};

test('QR preview does not change presence; retrying EXIT cannot record RETURN', async () => {
  const { controller, state } = setup();
  const preview = response();
  await controller.verifyQr({ body: { qr_token: 'qr' }, user: { _id: 'guard' } }, preview);
  assert.equal(preview.body.action, 'EXIT');
  assert.equal(state.row.status, 'Approved');
  assert.equal((await scan(controller, 'EXIT')).statusCode, 200);
  assert.equal((await scan(controller, 'EXIT')).statusCode, 409);
  assert.equal(state.row.status, 'Checked Out');
  assert.equal((await scan(controller, 'RETURN')).statusCode, 200);
  assert.equal(state.row.status, 'Returned');
  assert.equal((await scan(controller, 'RETURN')).statusCode, 409);
  assert.equal(state.logs.filter((l) => l.result === 'SUCCESS').length, 2);
});

test('QR commit requires an explicit action and concurrent EXIT requests change presence once', async () => {
  const { controller, state } = setup();
  assert.equal((await scan(controller)).statusCode, 400);
  assert.equal(state.row.status, 'Approved');
  const results = await Promise.all([scan(controller, 'EXIT'), scan(controller, 'EXIT')]);
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(state.row.status, 'Checked Out');
});

test('legacy update refuses to overwrite a concurrent gate transition', async () => {
  const { controller, state } = setup('Pending');
  state.beforeUpdate = (row) => { row.status = 'Checked Out'; };
  const res = response();
  await controller.updateOutpass({ body: { status: 'Rejected' }, params: { id: 'pass' }, user: { role: 'admin', _id: 'admin' } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(state.row.status, 'Checked Out');
});

test('legacy update still saves an uncontested rejection and remarks', async () => {
  const { controller, state } = setup('Pending');
  const res = response();
  await controller.updateOutpass({ body: { status: 'Rejected', admin_remarks: 'Not permitted' }, params: { id: 'pass' }, user: { role: 'admin', _id: 'admin' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(state.row.status, 'Rejected');
  assert.equal(state.row.admin_remarks, 'Not permitted');
});
