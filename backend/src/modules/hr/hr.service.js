import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Le frontend envoie des dates « AAAA-MM-JJ » et des nombres sous forme de texte :
// on normalise et on ne garde que les champs connus du modèle.
const toDate = (v) => (v ? new Date(v) : v === '' ? null : v);
const toNum = (v) => (v === '' || v == null ? null : Number(v));
const EMPLOYEE_FIELDS = ['userId', 'employeeNumber', 'firstName', 'lastName', 'email', 'phone', 'birthDate', 'positionId',
  'departmentId', 'contractType', 'startDate', 'endDate', 'baseSalary', 'currency', 'bankAccount', 'active', 'avatarUrl'];
function cleanEmployee(input) {
  const d = {};
  for (const k of EMPLOYEE_FIELDS) if (input[k] !== undefined) d[k] = input[k];
  for (const k of ['birthDate', 'startDate', 'endDate']) if (k in d) d[k] = toDate(d[k]);
  if ('baseSalary' in d) d.baseSalary = toNum(d.baseSalary);
  for (const k of ['userId', 'positionId', 'departmentId', 'email', 'phone', 'bankAccount']) if (d[k] === '') d[k] = null;
  return d;
}

// ── Departments ───────────────────────────────────────────────

export async function listDepartments() {
  return prisma.hrDepartment.findMany({
    include: { _count: { select: { positions: true, employees: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function createDepartment(data) {
  return prisma.hrDepartment.create({ data });
}

export async function updateDepartment(id, data) {
  return prisma.hrDepartment.update({ where: { id }, data });
}

export async function deleteDepartment(id) {
  const count = await prisma.hrEmployee.count({ where: { departmentId: id } });
  if (count > 0) throw { status: 400, message: 'Département utilisé par des employés' };
  return prisma.hrDepartment.delete({ where: { id } });
}

// ── Positions ─────────────────────────────────────────────────

export async function listPositions(departmentId) {
  return prisma.hrPosition.findMany({
    where: departmentId ? { departmentId } : undefined,
    include: {
      department: { select: { id: true, name: true } },
      _count: { select: { employees: true } },
    },
    orderBy: { title: 'asc' },
  });
}

export async function createPosition(data) {
  return prisma.hrPosition.create({ data, include: { department: true } });
}

export async function updatePosition(id, data) {
  const { title, code, departmentId, payCalcMode, active } = data;
  return prisma.hrPosition.update({
    where: { id },
    data: {
      ...(title       !== undefined && { title }),
      ...(code        !== undefined && { code }),
      ...(payCalcMode !== undefined && { payCalcMode }),
      ...(active      !== undefined && { active }),
      ...(departmentId !== undefined && {
        department: departmentId ? { connect: { id: departmentId } } : { disconnect: true },
      }),
    },
    include: { department: true },
  });
}

export async function deletePosition(id) {
  const count = await prisma.hrEmployee.count({ where: { positionId: id } });
  if (count > 0) throw { status: 400, message: 'Poste utilisé par des employés' };
  return prisma.hrPosition.delete({ where: { id } });
}

// ── Employees ─────────────────────────────────────────────────

export async function listEmployees({ search, departmentId, positionId, contractType, active, page = 1, limit = 20 }) {
  const where = {
    ...(search && {
      OR: [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { employeeNumber: { contains: search } },
        { email: { contains: search } },
        { user: { firstName: { contains: search } } },
        { user: { lastName:  { contains: search } } },
      ],
    }),
    ...(departmentId && { departmentId }),
    ...(positionId && { positionId }),
    ...(contractType && { contractType }),
    ...(active !== undefined && { active: active === 'true' }),
  };
  const [total, data] = await Promise.all([
    prisma.hrEmployee.count({ where }),
    prisma.hrEmployee.findMany({
      where,
      include: {
        position:   { select: { id: true, title: true, payCalcMode: true } },
        department: { select: { id: true, name: true } },
        user:       { select: { id: true, firstName: true, lastName: true, email: true, systemRole: true } },
        contracts:  { orderBy: { startDate: 'desc' }, take: 1 },
      },
      skip: (page - 1) * limit,
      take: Number(limit),
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
  ]);
  return { data, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) };
}

export async function getEmployee(id) {
  const emp = await prisma.hrEmployee.findUnique({
    where: { id },
    include: {
      position: true,
      department: true,
      contracts: { orderBy: { startDate: 'desc' } },
      leaves: { orderBy: { startDate: 'desc' }, take: 10 },
    },
  });
  if (!emp) throw { status: 404, message: 'Employé introuvable' };
  return emp;
}

export async function listStaffUsers() {
  // Users not yet linked to an HR employee record
  const linked = await prisma.hrEmployee.findMany({ select: { userId: true }, where: { userId: { not: null } } });
  const linkedIds = linked.map(e => e.userId).filter(Boolean);
  return prisma.user.findMany({
    where: { id: { notIn: linkedIds }, isActive: true, systemRole: { in: ['STAFF', 'TEACHER', 'SUPER_ADMIN'] } },
    select: { id: true, firstName: true, lastName: true, email: true, systemRole: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
}

export async function createEmployee(input) {
  const data = cleanEmployee(input);
  if (!data.startDate) data.startDate = new Date();
  // If linking to an existing user, pull name/email from that user
  if (data.userId) {
    const u = await prisma.user.findUnique({ where: { id: data.userId }, select: { firstName: true, lastName: true, email: true } });
    if (!u) throw { status: 404, message: 'Utilisateur introuvable' };
    const existing = await prisma.hrEmployee.findFirst({ where: { userId: data.userId } });
    if (existing) throw { status: 409, message: 'Cet utilisateur est déjà lié à un employé' };
    data.firstName = data.firstName || u.firstName;
    data.lastName  = data.lastName  || u.lastName;
    data.email     = data.email     || u.email;
  }
  if (!data.employeeNumber) {
    const count = await prisma.hrEmployee.count();
    data.employeeNumber = `EMP-${String(count + 1).padStart(5, '0')}`;
  }
  return prisma.hrEmployee.create({
    data,
    include: { position: true, department: true, user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
}

export async function updateEmployee(id, input) {
  const data = cleanEmployee(input);
  delete data.employeeNumber;
  return prisma.hrEmployee.update({
    where: { id },
    data,
    include: { position: true, department: true, user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
}

// Soft delete
export async function deactivateEmployee(id) {
  return prisma.hrEmployee.update({
    where: { id },
    data: { active: false, endDate: new Date() },
  });
}

// ── Contracts ─────────────────────────────────────────────────

export async function listContracts(employeeId) {
  return prisma.hrContract.findMany({
    where: { employeeId },
    orderBy: { startDate: 'desc' },
  });
}

export async function createContract(data) {
  const { employeeId, type, payCalcMode, startDate, endDate, baseSalary, currency, notes, documentUrl } = data;
  const contract = await prisma.hrContract.create({
    data: {
      employeeId,
      type: type ?? 'CDI',
      payCalcMode: payCalcMode ?? 'FIXED',
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      baseSalary: baseSalary != null ? Number(baseSalary) : null,
      currency: currency ?? 'MGA',
      notes: notes ?? null,
      documentUrl: documentUrl ?? null,
    },
  });
  // Sync employee contractType and baseSalary from latest contract
  await prisma.hrEmployee.update({
    where: { id: employeeId },
    data: {
      contractType: type ?? 'CDI',
      baseSalary: payCalcMode === 'HOURLY' ? null : (baseSalary != null ? Number(baseSalary) : null),
    },
  });
  return contract;
}

export async function updateContract(id, data) {
  const { type, payCalcMode, startDate, endDate, baseSalary, currency, notes } = data;
  return prisma.hrContract.update({
    where: { id },
    data: {
      ...(type !== undefined && { type }),
      ...(payCalcMode !== undefined && { payCalcMode }),
      ...(startDate !== undefined && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(baseSalary !== undefined && { baseSalary: baseSalary != null ? Number(baseSalary) : null }),
      ...(currency !== undefined && { currency }),
      ...(notes !== undefined && { notes }),
    },
  });
}

// ── Salary Grids ──────────────────────────────────────────────

export async function listSalaryGrids() {
  return prisma.hrSalaryGrid.findMany({
    include: {
      position: { select: { id: true, title: true, code: true } },
      components: { orderBy: [{ type: 'asc' }, { order: 'asc' }] },
    },
    orderBy: { position: { title: 'asc' } },
  });
}

export async function getSalaryGrid(positionId) {
  const grid = await prisma.hrSalaryGrid.findUnique({
    where: { positionId },
    include: { position: true, components: { orderBy: [{ type: 'asc' }, { order: 'asc' }] } },
  });
  if (!grid) throw { status: 404, message: 'Grille salariale introuvable' };
  return grid;
}

export async function upsertSalaryGrid(positionId, { currency, components }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.hrSalaryGrid.findUnique({ where: { positionId } });
    let grid;
    if (existing) {
      grid = await tx.hrSalaryGrid.update({ where: { positionId }, data: { currency } });
      await tx.hrSalaryComponent.deleteMany({ where: { gridId: existing.id } });
    } else {
      grid = await tx.hrSalaryGrid.create({ data: { positionId, currency } });
    }
    if (components?.length) {
      await tx.hrSalaryComponent.createMany({
        data: components.map((c, i) => ({
          type: c.type, label: c.label, code: c.code || `C${i + 1}`,
          amount: Number(c.amount) || 0, isPercent: !!c.isPercent, active: c.active ?? true,
          gridId: grid.id, order: c.order ?? i,
        })),
      });
    }
    return tx.hrSalaryGrid.findUnique({
      where: { id: grid.id },
      include: { position: true, components: { orderBy: [{ type: 'asc' }, { order: 'asc' }] } },
    });
  });
}

export async function applyGridToEmployees(positionId) {
  const grid = await prisma.hrSalaryGrid.findUnique({
    where: { positionId },
    include: { components: true, position: true },
  });
  if (!grid) throw { status: 404, message: 'Aucune grille salariale pour ce poste' };

  const position = grid.position;
  if (position?.payCalcMode === 'HOURLY') {
    // For hourly positions, no fixed baseSalary to sync — just return count
    const count = await prisma.hrEmployee.count({ where: { positionId, active: true } });
    return { updated: 0, skipped: count, reason: 'Mode horaire — salaire calculé depuis les heures' };
  }

  // Compute the total fixed gains as the reference — used as a suggestion, not auto-applied to employees
  const baseSalary = grid.components
    .filter(c => c.type === 'GAIN' && !c.isPercent && c.active !== false)
    .reduce((s, c) => s + c.amount, 0);

  // Do NOT auto-write baseSalary on employees — salary must be set explicitly via contracts
  const count = await prisma.hrEmployee.count({ where: { positionId, active: true } });
  return { updated: 0, skipped: count, baseSalary, message: `Référence de la grille : ${baseSalary.toLocaleString('fr-FR')} MGA. Pour appliquer, créez un contrat manuellement pour chaque employé.` };
}

// ── Leave Types ───────────────────────────────────────────────

export async function listLeaveTypes() {
  return prisma.hrLeaveType.findMany({ orderBy: { name: 'asc' } });
}

export async function createLeaveType(data) {
  return prisma.hrLeaveType.create({ data });
}

export async function updateLeaveType(id, data) {
  return prisma.hrLeaveType.update({ where: { id }, data });
}

// ── Leaves ────────────────────────────────────────────────────

export async function listLeaves({ employeeId, status, page = 1, limit = 20 }) {
  const where = {
    ...(employeeId && { employeeId }),
    ...(status && { status }),
  };
  const [total, data] = await Promise.all([
    prisma.hrLeave.count({ where }),
    prisma.hrLeave.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
      },
      skip: (page - 1) * limit,
      take: Number(limit),
      orderBy: { startDate: 'desc' },
    }),
  ]);
  return { data, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) };
}

export async function createLeave({ employeeId, leaveTypeId, startDate, endDate, days, reason }) {
  if (!employeeId || !startDate || !endDate) throw { status: 400, message: 'Employé, date de début et date de fin requis' };
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) throw { status: 400, message: 'La date de fin précède la date de début' };
  const nbDays = Number(days) || Math.round((end - start) / 86_400_000) + 1;
  return prisma.hrLeave.create({
    data: { employeeId, leaveTypeId: leaveTypeId || null, startDate: start, endDate: end, days: nbDays, reason: reason || null },
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function updateLeaveStatus(id, { status, approvedById }) {
  return prisma.hrLeave.update({
    where: { id },
    data: {
      status,
      approvedById: status === 'APPROVED' || status === 'REFUSED' ? approvedById : undefined,
      approvedAt: status === 'APPROVED' || status === 'REFUSED' ? new Date() : undefined,
    },
  });
}

// ── Hourly Rate Settings ─────────────────────────────────────

export async function getHourlyRateSettings() {
  const s = await prisma.hrHourlyRateSettings.findFirst();
  return s ?? { rateCM: 0, rateTD: 0, rateTP: 0, rateHS: 0 };
}

export async function upsertHourlyRateSettings({ rateCM, rateTD, rateTP, rateHS }, userId) {
  const existing = await prisma.hrHourlyRateSettings.findFirst();
  const data = { rateCM: Number(rateCM), rateTD: Number(rateTD), rateTP: Number(rateTP), rateHS: Number(rateHS), updatedBy: userId };
  if (existing) return prisma.hrHourlyRateSettings.update({ where: { id: existing.id }, data });
  return prisma.hrHourlyRateSettings.create({ data });
}

// ── Payroll ───────────────────────────────────────────────────

// Count how many times each DayOfWeek enum value appears in a given month
function dayOccurrencesInMonth(year, month) {
  const names = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const counts = { SUNDAY: 0, MONDAY: 0, TUESDAY: 0, WEDNESDAY: 0, THURSDAY: 0, FRIDAY: 0, SATURDAY: 0 };
  const days = new Date(year, month, 0).getDate(); // month is 1-based
  for (let d = 1; d <= days; d++) counts[names[new Date(year, month - 1, d).getDay()]]++;
  return counts;
}

// Parse "HH:MM" duration in decimal hours
function slotHours(startTime, endTime) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
}

export async function listPayrollPeriods() {
  return prisma.hrPayrollPeriod.findMany({
    include: { _count: { select: { payslips: true } } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });
}

export async function createPayrollPeriod({ month, year }) {
  return prisma.hrPayrollPeriod.create({ data: { month, year } });
}

export async function calculatePayroll(periodId) {
  const period = await prisma.hrPayrollPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw { status: 404, message: 'Période introuvable' };
  if (period.status !== 'DRAFT') throw { status: 400, message: 'Cette période a déjà été calculée' };

  const rates = await getHourlyRateSettings();
  const dayCounts = dayOccurrencesInMonth(period.year, period.month);

  const employees = await prisma.hrEmployee.findMany({
    where: { active: true },
    include: {
      position: { include: { salaryGrid: { include: { components: true } } } },
    },
  });

  await prisma.$transaction(async (tx) => {
    for (const emp of employees) {
      const mode = emp.position?.payCalcMode ?? 'FIXED';
      const items = [];
      let baseSalary, gains, deductions = 0;

      if (mode === 'HOURLY') {
        // Link HrEmployee → TeacherProfile via employeeId or shared userId
        const teacherProfile = await prisma.teacherProfile.findFirst({
          where: emp.userId
            ? { OR: [{ employeeId: emp.id }, { userId: emp.userId }] }
            : { employeeId: emp.id },
        });

        let hoursCM = 0, hoursTD = 0, hoursTP = 0, hoursHS = 0;

        if (teacherProfile) {
          const entries = await prisma.timetableEntry.findMany({ where: { teacherId: teacherProfile.id } });
          for (const e of entries) {
            const h = slotHours(e.startTime, e.endTime) * (dayCounts[e.day] ?? 0);
            if (e.type === 'CM')      hoursCM += h;
            else if (e.type === 'TD') hoursTD += h;
            else if (e.type === 'TP') hoursTP += h;
            else                      hoursHS += h;
          }
        }

        const amtCM = hoursCM * rates.rateCM;
        const amtTD = hoursTD * rates.rateTD;
        const amtTP = hoursTP * rates.rateTP;
        const amtHS = hoursHS * rates.rateHS;

        baseSalary = 0; // hourly: no fixed base
        gains = amtCM + amtTD + amtTP + amtHS;

        if (amtCM > 0) items.push({ type: 'GAIN', code: 'CM', label: `CM — ${hoursCM.toFixed(1)}h × ${rates.rateCM} MGA`, amount: amtCM, isPercent: false });
        if (amtTD > 0) items.push({ type: 'GAIN', code: 'TD', label: `TD — ${hoursTD.toFixed(1)}h × ${rates.rateTD} MGA`, amount: amtTD, isPercent: false });
        if (amtTP > 0) items.push({ type: 'GAIN', code: 'TP', label: `TP — ${hoursTP.toFixed(1)}h × ${rates.rateTP} MGA`, amount: amtTP, isPercent: false });
        if (amtHS > 0) items.push({ type: 'GAIN', code: 'HS', label: `Heures supp. — ${hoursHS.toFixed(1)}h × ${rates.rateHS} MGA`, amount: amtHS, isPercent: false });

        // Apply salary grid DEDUCTIONS on top (CNAPS, OSIE, IRSA…)
        for (const comp of (emp.position?.salaryGrid?.components ?? []).filter(c => c.type === 'DEDUCTION')) {
          const amount = comp.isPercent ? (gains * comp.amount) / 100 : comp.amount;
          items.push({ code: comp.code, label: comp.label, type: 'DEDUCTION', amount, isPercent: comp.isPercent });
          deductions += amount;
        }

      } else {
        // FIXED salary mode — standard base + grid components
        baseSalary = emp.baseSalary ?? 0;
        gains = baseSalary;

        for (const comp of (emp.position?.salaryGrid?.components ?? [])) {
          const amount = comp.isPercent ? (baseSalary * comp.amount) / 100 : comp.amount;
          items.push({ code: comp.code, label: comp.label, type: comp.type, amount, isPercent: comp.isPercent, base: comp.isPercent ? baseSalary : null });
          if (comp.type === 'GAIN') gains += amount;
          else deductions += amount;
        }
      }

      // Part enseignant des cours payants (pourcentage en vigueur à chaque vente), en attente de versement.
      let earningIds = [];
      if (emp.userId) {
        const earnings = await tx.teacherEarning.findMany({
          where: { teacherId: emp.userId, status: 'PENDING' },
          select: { id: true, teacherShare: true },
        });
        const share = earnings.reduce((sum, e) => sum + e.teacherShare, 0);
        if (share > 0) {
          items.push({ type: 'GAIN', code: 'COURS_EN_LIGNE', label: `Part enseignant des cours payants — ${earnings.length} vente(s)`, amount: share, isPercent: false });
          gains += share;
          earningIds = earnings.map((e) => e.id);
        }
      }

      const netSalary = Math.max(0, gains - deductions);

      const payslip = await tx.hrPayslip.upsert({
        where: { employeeId_periodId: { employeeId: emp.id, periodId } },
        create: { employeeId: emp.id, periodId, baseSalary, grossSalary: gains, deductions, netSalary, items, status: 'CALCULATED' },
        update: { baseSalary, grossSalary: gains, deductions, netSalary, items, status: 'CALCULATED' },
      });
      if (earningIds.length) {
        await tx.teacherEarning.updateMany({
          where: { id: { in: earningIds } },
          data: { status: 'IN_PAYSLIP', payslipId: payslip.id },
        });
      }
    }
    await tx.hrPayrollPeriod.update({ where: { id: periodId }, data: { status: 'CALCULATED' } });
  });

  return prisma.hrPayrollPeriod.findUnique({
    where: { id: periodId },
    include: { _count: { select: { payslips: true } } },
  });
}

export async function validatePayroll(periodId, userId) {
  const period = await prisma.hrPayrollPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw { status: 404, message: 'Période introuvable' };
  if (period.status !== 'CALCULATED') throw { status: 400, message: 'La période doit d\'abord être calculée' };

  await prisma.$transaction([
    prisma.hrPayslip.updateMany({ where: { periodId, status: 'CALCULATED' }, data: { status: 'VALIDATED', validatedById: userId, validatedAt: new Date() } }),
    prisma.hrPayrollPeriod.update({ where: { id: periodId }, data: { status: 'VALIDATED' } }),
  ]);
  return { ok: true };
}

export async function markPayrollPaid(periodId) {
  const payslips = await prisma.hrPayslip.findMany({ where: { periodId, status: 'VALIDATED' }, select: { id: true } });
  await prisma.$transaction([
    prisma.teacherEarning.updateMany({
      where: { payslipId: { in: payslips.map((p) => p.id) }, status: 'IN_PAYSLIP' },
      data: { status: 'PAID' },
    }),
    prisma.hrPayslip.updateMany({ where: { periodId, status: 'VALIDATED' }, data: { status: 'PAID', paidAt: new Date() } }),
    prisma.hrPayrollPeriod.update({ where: { id: periodId }, data: { status: 'PAID', closedAt: new Date() } }),
  ]);
  return { ok: true };
}

export async function listPayslips({ periodId, employeeId, status, page = 1, limit = 50 }) {
  const where = {
    ...(periodId && { periodId }),
    ...(employeeId && { employeeId }),
    ...(status && { status }),
  };
  const [total, data] = await Promise.all([
    prisma.hrPayslip.count({ where }),
    prisma.hrPayslip.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } },
        period: { select: { id: true, month: true, year: true, status: true } },
      },
      skip: (page - 1) * limit,
      take: Number(limit),
      orderBy: { employee: { lastName: 'asc' } },
    }),
  ]);
  return { data, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) };
}

export async function getPayslip(id) {
  const slip = await prisma.hrPayslip.findUnique({
    where: { id },
    include: {
      employee: { include: { position: true, department: true } },
      period: true,
    },
  });
  if (!slip) throw { status: 404, message: 'Bulletin introuvable' };
  return slip;
}

// ── Dashboard ─────────────────────────────────────────────────

export async function hrDashboard() {
  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const thisYear = now.getFullYear();

  const [totalEmployees, activeEmployees, byDept, byContract, currentPeriod, pendingLeaves] =
    await Promise.all([
      prisma.hrEmployee.count(),
      prisma.hrEmployee.count({ where: { active: true } }),
      prisma.hrEmployee.groupBy({ by: ['departmentId'], _count: { id: true }, where: { active: true } }),
      prisma.hrEmployee.groupBy({ by: ['contractType'], _count: { id: true }, where: { active: true } }),
      prisma.hrPayrollPeriod.findFirst({ where: { month: thisMonth, year: thisYear } }),
      prisma.hrLeave.count({ where: { status: 'PENDING' } }),
    ]);

  const deptNames = await prisma.hrDepartment.findMany({ select: { id: true, name: true } });
  const deptMap = Object.fromEntries(deptNames.map((d) => [d.id, d.name]));

  let payrollMass = 0;
  if (currentPeriod) {
    const agg = await prisma.hrPayslip.aggregate({ where: { periodId: currentPeriod.id }, _sum: { netSalary: true } });
    payrollMass = agg._sum.netSalary ?? 0;
  }

  return {
    totalEmployees,
    activeEmployees,
    pendingLeaves,
    payrollMass,
    currentPeriodStatus: currentPeriod?.status ?? null,
    byDepartment: byDept.map((d) => ({ name: deptMap[d.departmentId] ?? 'Non assigné', count: d._count.id })),
    byContractType: byContract.map((c) => ({ type: c.contractType, count: c._count.id })),
  };
}
