import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { requirePermission } from '../../middlewares/rbac.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as svc from './hr.service.js';

const r = Router();
// Personnel & salaires : administrateur et comptabilité uniquement.
r.use(authenticate, requirePermission('MANAGE_HR'));

// ── Dashboard ─────────────────────────────────────────────────
r.get('/dashboard', asyncHandler(async (req, res) => {
  res.json(await svc.hrDashboard());
}));

// ── Hourly Rate Settings ──────────────────────────────────────
r.get('/settings/hourly-rates', asyncHandler(async (req, res) => {
  res.json(await svc.getHourlyRateSettings());
}));

r.put('/settings/hourly-rates', asyncHandler(async (req, res) => {
  res.json(await svc.upsertHourlyRateSettings(req.body, req.user?.id));
}));

// ── Departments ───────────────────────────────────────────────
r.get('/departments', asyncHandler(async (req, res) => {
  res.json(await svc.listDepartments());
}));

r.post('/departments', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createDepartment(req.body));
}));

r.put('/departments/:id', asyncHandler(async (req, res) => {
  res.json(await svc.updateDepartment(req.params.id, req.body));
}));

r.delete('/departments/:id', asyncHandler(async (req, res) => {
  await svc.deleteDepartment(req.params.id);
  res.json({ ok: true });
}));

// ── Positions ─────────────────────────────────────────────────
r.get('/positions', asyncHandler(async (req, res) => {
  res.json(await svc.listPositions(req.query.departmentId));
}));

r.post('/positions', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createPosition(req.body));
}));

r.put('/positions/:id', asyncHandler(async (req, res) => {
  res.json(await svc.updatePosition(req.params.id, req.body));
}));

r.delete('/positions/:id', asyncHandler(async (req, res) => {
  await svc.deletePosition(req.params.id);
  res.json({ ok: true });
}));

// ── Staff user picker (for linking employees to real user accounts) ──
r.get('/staff-users', asyncHandler(async (req, res) => {
  res.json(await svc.listStaffUsers());
}));

// ── Employees ─────────────────────────────────────────────────
r.get('/employees', asyncHandler(async (req, res) => {
  res.json(await svc.listEmployees(req.query));
}));

r.get('/employees/:id', asyncHandler(async (req, res) => {
  res.json(await svc.getEmployee(req.params.id));
}));

r.post('/employees', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createEmployee(req.body));
}));

r.put('/employees/:id', asyncHandler(async (req, res) => {
  res.json(await svc.updateEmployee(req.params.id, req.body));
}));

r.patch('/employees/:id/deactivate', asyncHandler(async (req, res) => {
  res.json(await svc.deactivateEmployee(req.params.id));
}));

// ── Contracts ─────────────────────────────────────────────────
r.get('/employees/:employeeId/contracts', asyncHandler(async (req, res) => {
  res.json(await svc.listContracts(req.params.employeeId));
}));

r.post('/employees/:employeeId/contracts', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createContract({ ...req.body, employeeId: req.params.employeeId }));
}));

r.put('/contracts/:id', asyncHandler(async (req, res) => {
  res.json(await svc.updateContract(req.params.id, req.body));
}));

// ── Salary Grids ──────────────────────────────────────────────
r.get('/salary-grids', asyncHandler(async (req, res) => {
  res.json(await svc.listSalaryGrids());
}));

r.get('/salary-grids/:positionId', asyncHandler(async (req, res) => {
  res.json(await svc.getSalaryGrid(req.params.positionId));
}));

r.put('/salary-grids/:positionId', asyncHandler(async (req, res) => {
  res.json(await svc.upsertSalaryGrid(req.params.positionId, req.body));
}));

r.post('/salary-grids/:positionId/apply-to-employees', asyncHandler(async (req, res) => {
  res.json(await svc.applyGridToEmployees(req.params.positionId));
}));

// ── Leave Types ───────────────────────────────────────────────
r.get('/leave-types', asyncHandler(async (req, res) => {
  res.json(await svc.listLeaveTypes());
}));

r.post('/leave-types', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createLeaveType(req.body));
}));

r.put('/leave-types/:id', asyncHandler(async (req, res) => {
  res.json(await svc.updateLeaveType(req.params.id, req.body));
}));

// ── Leaves ────────────────────────────────────────────────────
r.get('/leaves', asyncHandler(async (req, res) => {
  res.json(await svc.listLeaves(req.query));
}));

r.post('/leaves', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createLeave(req.body));
}));

r.patch('/leaves/:id/status', asyncHandler(async (req, res) => {
  res.json(await svc.updateLeaveStatus(req.params.id, { ...req.body, approvedById: req.user.id }));
}));

// ── Payroll Periods ───────────────────────────────────────────
r.get('/payroll/periods', asyncHandler(async (req, res) => {
  res.json(await svc.listPayrollPeriods());
}));

r.post('/payroll/periods', asyncHandler(async (req, res) => {
  res.status(201).json(await svc.createPayrollPeriod(req.body));
}));

r.post('/payroll/periods/:id/calculate', asyncHandler(async (req, res) => {
  res.json(await svc.calculatePayroll(req.params.id));
}));

r.post('/payroll/periods/:id/validate', asyncHandler(async (req, res) => {
  res.json(await svc.validatePayroll(req.params.id, req.user.id));
}));

r.post('/payroll/periods/:id/mark-paid', asyncHandler(async (req, res) => {
  res.json(await svc.markPayrollPaid(req.params.id));
}));

// ── Payslips ──────────────────────────────────────────────────
r.get('/payroll/payslips', asyncHandler(async (req, res) => {
  res.json(await svc.listPayslips(req.query));
}));

r.get('/payroll/payslips/:id', asyncHandler(async (req, res) => {
  res.json(await svc.getPayslip(req.params.id));
}));

export default r;
