// Mise à jour « Note à jour UR2 » — idempotent, relançable.
//   node prisma/seed-maj-ur2.js
//
//  • permission RECORD_TUITION_CASH (guichet écolage) accordée au Secrétariat
//  • paramètres financiers par défaut (devise, modes de paiement, types de frais…)
//  • référentiel RH de base (départements, postes, types de congé)
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const NEW_PERMS = [
  { code: 'RECORD_TUITION_CASH', label: "Encaisser l'écolage au guichet", module: 'FINANCE' },
]

async function grant(roleName, codes) {
  const role = await prisma.role.findUnique({ where: { name: roleName } })
  if (!role) return console.warn(`  ⚠ rôle « ${roleName} » introuvable`)
  const perms = await prisma.permission.findMany({ where: { code: { in: codes } } })
  for (const p of perms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
      update: {}, create: { roleId: role.id, permissionId: p.id },
    })
  }
}

async function upsertAll(model, rows) {
  for (const r of rows) await prisma[model].upsert({ where: { code: r.code }, update: {}, create: r })
}

async function seedFinanceSettings() {
  await upsertAll('financeCurrency', [
    { code: 'MGA', name: 'Ariary malgache', symbol: 'Ar', isDefault: true },
    { code: 'EUR', name: 'Euro', symbol: '€' },
  ])
  await upsertAll('financePaymentMethod', [
    { code: 'CASH', name: 'Espèces (bureau)', description: 'Paiement physique au secrétariat / à la caisse', order: 1 },
    { code: 'MVOLA', name: 'MVola', description: 'Mobile Money Telma', order: 2 },
    { code: 'ORANGE_MONEY', name: 'Orange Money', order: 3 },
    { code: 'AIRTEL_MONEY', name: 'Airtel Money', order: 4 },
    { code: 'BANK_TRANSFER', name: 'Virement bancaire', order: 5 },
    { code: 'CHEQUE', name: 'Chèque', order: 6 },
  ])
  await upsertAll('financeFeeCategory', [
    { code: 'SCOLARITE', name: 'Scolarité', color: '#2563EB', order: 1 },
    { code: 'ADMIN', name: 'Frais administratifs', color: '#7C3AED', order: 2 },
    { code: 'EXAMEN', name: 'Examens', color: '#D97706', order: 3 },
    { code: 'DIVERS', name: 'Divers', color: '#64748B', order: 4 },
  ])
  await upsertAll('financeFeeType', [
    { code: 'INSCRIPTION', name: "Droit d'inscription", category: 'ADMIN', mandatory: true, order: 1 },
    { code: 'REINSCRIPTION', name: 'Droit de réinscription', category: 'ADMIN', mandatory: false, order: 2 },
    { code: 'ECOLAGE', name: 'Écolage', category: 'SCOLARITE', mandatory: true, order: 3 },
    { code: 'EXAMEN', name: "Frais d'examen", category: 'EXAMEN', mandatory: true, order: 4 },
    { code: 'CARTE', name: 'Carte étudiante', category: 'ADMIN', mandatory: true, order: 5 },
    { code: 'ATTESTATION', name: 'Attestation / relevé', category: 'DIVERS', mandatory: false, order: 6 },
  ])
  await upsertAll('financePenalty', [
    { code: 'RETARD_15J', name: 'Retard de paiement (15 jours)', percent: 5, triggerDays: 15 },
  ])
  await upsertAll('financeDiscount', [
    { code: 'FRATRIE', name: 'Réduction fratrie', percent: 10, description: 'Deux enfants ou plus inscrits' },
  ])
  await upsertAll('financeScholarship', [
    { code: 'BOURSE_MERITE', name: 'Bourse au mérite', coverageType: 'PERCENT', coverageValue: 50 },
  ])
  await upsertAll('financeAccountingAccount', [
    { code: '706100', name: 'Écolage', type: 'REVENUE' },
    { code: '706200', name: "Droits d'inscription", type: 'REVENUE' },
    { code: '531000', name: 'Caisse', type: 'ASSET' },
    { code: '512000', name: 'Banque', type: 'ASSET' },
    { code: '641000', name: 'Rémunérations du personnel', type: 'EXPENSE' },
  ])
  await upsertAll('financeCashRegister', [
    { code: 'CAISSE-SEC', name: 'Caisse du secrétariat', description: 'Encaissements physiques au bureau du secrétariat' },
    { code: 'CAISSE-COMPTA', name: 'Caisse comptabilité' },
  ])
  if (!(await prisma.financeFiscalYear.count())) {
    await prisma.financeFiscalYear.create({
      data: { label: '2025-2026', startDate: new Date('2025-10-01'), endDate: new Date('2026-09-30') },
    })
  }
  console.log('✅ Paramètres financiers par défaut')
}

async function seedHr() {
  const depts = [
    { code: 'ADM', name: 'Administration' },
    { code: 'PEDA', name: 'Pédagogie' },
    { code: 'FIN', name: 'Comptabilité / Finance' },
  ]
  const deptIds = {}
  for (const d of depts) {
    const found = await prisma.hrDepartment.findFirst({ where: { name: d.name } })
    deptIds[d.code] = (found ?? await prisma.hrDepartment.create({ data: { name: d.name } })).id
  }
  const positions = [
    { code: 'SEC', title: 'Secrétaire', dept: 'ADM', payCalcMode: 'FIXED' },
    { code: 'COMPTA', title: 'Comptable', dept: 'FIN', payCalcMode: 'FIXED' },
    { code: 'RP', title: 'Responsable Pédagogique', dept: 'PEDA', payCalcMode: 'FIXED' },
    { code: 'ENS-PERM', title: 'Enseignant permanent', dept: 'PEDA', payCalcMode: 'FIXED' },
    { code: 'ENS-VAC', title: 'Enseignant vacataire', dept: 'PEDA', payCalcMode: 'HOURLY' },
  ]
  for (const p of positions) {
    await prisma.hrPosition.upsert({
      where: { code: p.code }, update: {},
      create: { code: p.code, title: p.title, payCalcMode: p.payCalcMode, departmentId: deptIds[p.dept] },
    })
  }
  for (const lt of [
    { code: 'ANNUEL', name: 'Congé annuel', daysPerYear: 30, paid: true },
    { code: 'MALADIE', name: 'Congé maladie', daysPerYear: null, paid: true },
    { code: 'MATERNITE', name: 'Congé maternité', daysPerYear: 98, paid: true },
    { code: 'EXCEPTIONNEL', name: 'Permission exceptionnelle', daysPerYear: 10, paid: true },
    { code: 'SANS_SOLDE', name: 'Congé sans solde', daysPerYear: null, paid: false },
  ]) {
    await prisma.hrLeaveType.upsert({ where: { code: lt.code }, update: {}, create: lt })
  }
  console.log('✅ Référentiel RH de base')
}

async function main() {
  console.log('🔄 Mise à jour UR2...')
  for (const p of NEW_PERMS) {
    await prisma.permission.upsert({ where: { code: p.code }, update: {}, create: p })
  }
  await grant('Secrétaire / Admissions', ['RECORD_TUITION_CASH'])
  await grant('Super Administrateur', NEW_PERMS.map((p) => p.code))
  console.log('✅ Permissions à jour')
  await seedFinanceSettings()
  await seedHr()
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
