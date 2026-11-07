/**
 * Demo seed: Finance v2 + HR modules
 * Run: node src/seed-demo.js
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Finance v2 + HR demo data...');

  // ── Finance: Currencies ──────────────────────────────────────────────────────
  await prisma.financeCurrency.upsert({
    where: { code: 'MGA' },
    update: {},
    create: { code: 'MGA', name: 'Ariary malgache', symbol: 'Ar', isDefault: true, active: true },
  });
  await prisma.financeCurrency.upsert({
    where: { code: 'EUR' },
    update: {},
    create: { code: 'EUR', name: 'Euro', symbol: '€', isDefault: false, active: true },
  });
  console.log('  OK  Currencies');

  // ── Finance: Fee Categories ───────────────────────────────────────────────────
  const catData = [
    { code: 'SCOLARITE',    name: 'Scolarite',                 color: '#3B82F6', order: 1 },
    { code: 'INSCRIPTION',  name: 'Inscription',               color: '#8B5CF6', order: 2 },
    { code: 'EXAMEN',       name: 'Examens',                   color: '#F59E0B', order: 3 },
    { code: 'BIBLIOTHEQUE', name: 'Bibliotheque',              color: '#10B981', order: 4 },
    { code: 'LOGEMENT',     name: 'Logement & Restauration',   color: '#EC4899', order: 5 },
    { code: 'DIVERS',       name: 'Divers',                    color: '#6B7280', order: 6 },
  ];
  for (const c of catData) {
    await prisma.financeFeeCategory.upsert({
      where: { code: c.code },
      update: {},
      create: { name: c.name, code: c.code, color: c.color, order: c.order, active: true },
    });
  }
  console.log('  OK  Fee Categories');

  // ── Finance: Fee Types ────────────────────────────────────────────────────────
  const feeTypes = [
    { code: 'FRAIS_SCO',      name: 'Frais de scolarite',        category: 'SCOLARITE',    mandatory: true,  order: 1 },
    { code: 'FRAIS_INSCR',    name: "Frais d'inscription",       category: 'INSCRIPTION',  mandatory: true,  order: 2 },
    { code: 'FRAIS_EXAM',     name: "Frais d'examen",            category: 'EXAMEN',       mandatory: true,  order: 3 },
    { code: 'FRAIS_BIBLIO',   name: 'Abonnement bibliotheque',   category: 'BIBLIOTHEQUE', mandatory: false, order: 4 },
    { code: 'FRAIS_RESTO',    name: 'Frais de restauration',     category: 'LOGEMENT',     mandatory: false, order: 5 },
    { code: 'FRAIS_LOGEMENT', name: 'Frais de logement',         category: 'LOGEMENT',     mandatory: false, order: 6 },
    { code: 'FRAIS_SPORT',    name: 'Association sportive',      category: 'DIVERS',       mandatory: false, order: 7 },
    { code: 'FRAIS_DIPLOME',  name: 'Frais de diplome',          category: 'DIVERS',       mandatory: false, order: 8 },
  ];
  for (const ft of feeTypes) {
    await prisma.financeFeeType.upsert({
      where: { code: ft.code },
      update: {},
      create: { code: ft.code, name: ft.name, category: ft.category, mandatory: ft.mandatory, order: ft.order, active: true },
    });
  }
  console.log('  OK  Fee Types');

  // ── Finance: Payment Methods ──────────────────────────────────────────────────
  const payMethods = [
    { code: 'CASH',         name: 'Especes',           description: 'Paiement en cash au guichet',               order: 1 },
    { code: 'VIREMENT',     name: 'Virement bancaire', description: "Virement vers le compte de l'universite",   order: 2 },
    { code: 'MVOLA',        name: 'MVola',             description: 'Mobile money Telma MVola',                   order: 3 },
    { code: 'ORANGE_MONEY', name: 'Orange Money',      description: 'Mobile money Orange Madagascar',            order: 4 },
    { code: 'CHEQUE',       name: 'Cheque',            description: "Cheque bancaire a l'ordre de l'Universite", order: 5 },
    { code: 'CB',           name: 'Carte bancaire',    description: 'Paiement par carte TPE',                    order: 6 },
  ];
  for (const pm of payMethods) {
    await prisma.financePaymentMethod.upsert({
      where: { code: pm.code },
      update: {},
      create: { code: pm.code, name: pm.name, description: pm.description, order: pm.order, active: true },
    });
  }
  console.log('  OK  Payment Methods');

  // ── Finance: Penalties ────────────────────────────────────────────────────────
  await prisma.financePenalty.upsert({
    where: { code: 'RETARD_PAIEMENT' },
    update: {},
    create: { code: 'RETARD_PAIEMENT', name: 'Penalite de retard de paiement', percent: 2, triggerDays: 30, active: true },
  });
  await prisma.financePenalty.upsert({
    where: { code: 'ABANDON_COURS' },
    update: {},
    create: { code: 'ABANDON_COURS', name: 'Frais abandon de cours', amount: 50000, triggerDays: 0, active: true },
  });
  console.log('  OK  Penalties');

  // ── Finance: Discounts ────────────────────────────────────────────────────────
  await prisma.financeDiscount.upsert({
    where: { code: 'FAMILLE_NOMBREUSE' },
    update: {},
    create: { code: 'FAMILLE_NOMBREUSE', name: 'Remise famille nombreuse (3+ enfants)', percent: 15, active: true },
  });
  await prisma.financeDiscount.upsert({
    where: { code: 'MENTION_BIEN' },
    update: {},
    create: { code: 'MENTION_BIEN', name: 'Remise merite (mention Bien)', percent: 10, active: true },
  });
  await prisma.financeDiscount.upsert({
    where: { code: 'PERSONNEL_UNIV' },
    update: {},
    create: { code: 'PERSONNEL_UNIV', name: 'Remise enfant de personnel', amount: 100000, active: true },
  });
  console.log('  OK  Discounts');

  // ── Finance: Scholarships ─────────────────────────────────────────────────────
  await prisma.financeScholarship.upsert({
    where: { code: 'BOURSE_EXCELLENCE' },
    update: {},
    create: { code: 'BOURSE_EXCELLENCE', name: "Bourse d'excellence", coverageType: 'PERCENT', coverageValue: 100, description: '100% des frais - laureats BAC', active: true },
  });
  await prisma.financeScholarship.upsert({
    where: { code: 'BOURSE_SOCIALE' },
    update: {},
    create: { code: 'BOURSE_SOCIALE', name: 'Bourse sociale', coverageType: 'PERCENT', coverageValue: 50, description: 'Aide aux etudiants en situation difficile', active: true },
  });
  await prisma.financeScholarship.upsert({
    where: { code: 'BOURSE_PARTIELLE' },
    update: {},
    create: { code: 'BOURSE_PARTIELLE', name: 'Bourse partielle', coverageType: 'AMOUNT', coverageValue: 500000, description: 'Aide forfaitaire de 500 000 Ar', active: true },
  });
  console.log('  OK  Scholarships');

  // ── Finance: Accounting Accounts ──────────────────────────────────────────────
  const accData = [
    { code: '7000', name: 'Recettes - Frais de scolarite', type: 'REVENUE' },
    { code: '7001', name: "Recettes - Frais d'inscription", type: 'REVENUE' },
    { code: '7002', name: "Recettes - Frais d'examen",     type: 'REVENUE' },
    { code: '7003', name: 'Recettes - Bibliotheque',        type: 'REVENUE' },
    { code: '7099', name: 'Recettes - Divers',              type: 'REVENUE' },
    { code: '6000', name: 'Charges - Salaires',             type: 'EXPENSE' },
    { code: '6001', name: 'Charges - Cotisations sociales', type: 'EXPENSE' },
    { code: '5000', name: 'Caisse - Fonds disponibles',     type: 'ASSET'   },
    { code: '5100', name: 'Banque - Compte courant',        type: 'ASSET'   },
  ];
  for (const a of accData) {
    await prisma.financeAccountingAccount.upsert({
      where: { code: a.code },
      update: {},
      create: { code: a.code, name: a.name, type: a.type, active: true },
    });
  }
  console.log('  OK  Accounting Accounts');

  // ── Finance: Cash Registers ───────────────────────────────────────────────────
  const crData = [
    { code: 'CAISSE_PRINCIPALE', name: 'Caisse principale',  description: 'Caisse du bureau de scolarite' },
    { code: 'CAISSE_SCOLARITE',  name: 'Caisse scolarite',   description: 'Caisse dediec aux frais de scolarite' },
    { code: 'CAISSE_EXAM',       name: 'Caisse examens',     description: 'Caisse pour la periode des examens' },
  ];
  for (const cr of crData) {
    await prisma.financeCashRegister.upsert({
      where: { code: cr.code },
      update: {},
      create: { code: cr.code, name: cr.name, description: cr.description, active: true },
    });
  }
  console.log('  OK  Cash Registers');

  // ── Finance: Fiscal Years ─────────────────────────────────────────────────────
  const fyCount = await prisma.financeFiscalYear.count({ where: { label: 'Exercice 2024-2025' } });
  if (fyCount === 0) {
    await prisma.financeFiscalYear.create({
      data: { label: 'Exercice 2024-2025', startDate: new Date('2024-10-01'), endDate: new Date('2025-09-30'), isClosed: false },
    });
    await prisma.financeFiscalYear.create({
      data: { label: 'Exercice 2025-2026', startDate: new Date('2025-10-01'), endDate: new Date('2026-09-30'), isClosed: false },
    });
  }
  console.log('  OK  Fiscal Years');

  // ── HR: Departments ───────────────────────────────────────────────────────────
  const deptData = [
    { code: 'RECTORAT',     name: 'Rectorat' },
    { code: 'ADMIN',        name: 'Administration generale' },
    { code: 'SCOLARITE',    name: 'Service Scolarite' },
    { code: 'COMPTA',       name: 'Comptabilite & Finance' },
    { code: 'INFORMATIQUE', name: 'Departement Informatique' },
    { code: 'MATHS',        name: 'Departement Mathematiques' },
    { code: 'GESTION',      name: 'Departement Gestion' },
    { code: 'SCIENCES',     name: 'Departement Sciences' },
    { code: 'LANGUES',      name: 'Departement Langues' },
    { code: 'TECHNIQUE',    name: 'Services Techniques' },
  ];
  const depts = {};
  for (const d of deptData) {
    depts[d.code] = await prisma.hrDepartment.upsert({
      where: { code: d.code },
      update: {},
      create: { code: d.code, name: d.name, active: true },
    });
  }
  console.log('  OK  HR Departments');

  // ── HR: Positions ─────────────────────────────────────────────────────────────
  const posData = [
    { code: 'RECTEUR',       title: 'Recteur',                    dept: 'RECTORAT' },
    { code: 'DIR_ADMIN',     title: 'Directeur administratif',    dept: 'ADMIN' },
    { code: 'CHEF_DEPT',     title: 'Chef de departement',        dept: 'INFORMATIQUE' },
    { code: 'PROF_TITULAIRE',title: 'Professeur titulaire',       dept: 'INFORMATIQUE' },
    { code: 'MAITRE_CONF',   title: 'Maitre de conferences',      dept: 'INFORMATIQUE' },
    { code: 'ASSISTANT',     title: 'Assistant enseignant',       dept: 'INFORMATIQUE' },
    { code: 'VACATAIRE',     title: 'Enseignant vacataire',       dept: 'INFORMATIQUE' },
    { code: 'CHEF_SCOL',     title: 'Chef service scolarite',     dept: 'SCOLARITE' },
    { code: 'SECRETAIRE',    title: 'Secretaire',                 dept: 'SCOLARITE' },
    { code: 'COMPTABLE',     title: 'Comptable',                  dept: 'COMPTA' },
    { code: 'TRESORIER',     title: 'Tresorier',                  dept: 'COMPTA' },
    { code: 'TECH_INFO',     title: 'Technicien informatique',    dept: 'TECHNIQUE' },
    { code: 'AGENT_SECUR',   title: 'Agent de securite',          dept: 'TECHNIQUE' },
    { code: 'AGENT_ENTRETIEN', title: "Agent d'entretien",        dept: 'TECHNIQUE' },
  ];
  const positions = {};
  for (const p of posData) {
    const existing = await prisma.hrPosition.findUnique({ where: { code: p.code } });
    if (existing) {
      positions[p.code] = existing;
    } else {
      positions[p.code] = await prisma.hrPosition.create({
        data: { code: p.code, title: p.title, departmentId: depts[p.dept]?.id, active: true },
      });
    }
  }
  console.log('  OK  HR Positions');

  // ── HR: Salary Grids ──────────────────────────────────────────────────────────
  const gridDefs = [
    {
      posCode: 'PROF_TITULAIRE',
      components: [
        { type: 'GAIN',      label: 'Indemnite de cours',      code: 'INDMN_COURS',  amount: 800000, isPercent: false, order: 1, active: true },
        { type: 'GAIN',      label: 'Prime de recherche',      code: 'PRIME_RECH',   amount: 300000, isPercent: false, order: 2, active: true },
        { type: 'GAIN',      label: 'Indemnite de transport',  code: 'INDMN_TRANSP', amount: 150000, isPercent: false, order: 3, active: true },
        { type: 'DEDUCTION', label: 'Cotisation CNAPS (13%)',  code: 'CNAPS',        amount: 13,     isPercent: true,  order: 4, active: true },
        { type: 'DEDUCTION', label: 'OSIE (6%)',               code: 'OSIE',         amount: 6,      isPercent: true,  order: 5, active: true },
        { type: 'DEDUCTION', label: 'IRSA',                    code: 'IRSA',         amount: 50000,  isPercent: false, order: 6, active: true },
      ],
    },
    {
      posCode: 'MAITRE_CONF',
      components: [
        { type: 'GAIN',      label: 'Indemnite de cours',      code: 'INDMN_COURS',  amount: 600000, isPercent: false, order: 1, active: true },
        { type: 'GAIN',      label: 'Indemnite de transport',  code: 'INDMN_TRANSP', amount: 120000, isPercent: false, order: 2, active: true },
        { type: 'DEDUCTION', label: 'Cotisation CNAPS (13%)',  code: 'CNAPS',        amount: 13,     isPercent: true,  order: 3, active: true },
        { type: 'DEDUCTION', label: 'OSIE (6%)',               code: 'OSIE',         amount: 6,      isPercent: true,  order: 4, active: true },
        { type: 'DEDUCTION', label: 'IRSA',                    code: 'IRSA',         amount: 30000,  isPercent: false, order: 5, active: true },
      ],
    },
    {
      posCode: 'ASSISTANT',
      components: [
        { type: 'GAIN',      label: 'Indemnite de cours',      code: 'INDMN_COURS',  amount: 400000, isPercent: false, order: 1, active: true },
        { type: 'GAIN',      label: 'Indemnite de transport',  code: 'INDMN_TRANSP', amount: 100000, isPercent: false, order: 2, active: true },
        { type: 'DEDUCTION', label: 'Cotisation CNAPS (13%)',  code: 'CNAPS',        amount: 13,     isPercent: true,  order: 3, active: true },
        { type: 'DEDUCTION', label: 'IRSA',                    code: 'IRSA',         amount: 15000,  isPercent: false, order: 4, active: true },
      ],
    },
    {
      posCode: 'SECRETAIRE',
      components: [
        { type: 'GAIN',      label: 'Prime de rendement',      code: 'PRIME_REND',   amount: 100000, isPercent: false, order: 1, active: true },
        { type: 'GAIN',      label: 'Indemnite de transport',  code: 'INDMN_TRANSP', amount: 80000,  isPercent: false, order: 2, active: true },
        { type: 'DEDUCTION', label: 'Cotisation CNAPS (13%)',  code: 'CNAPS',        amount: 13,     isPercent: true,  order: 3, active: true },
        { type: 'DEDUCTION', label: 'IRSA',                    code: 'IRSA',         amount: 10000,  isPercent: false, order: 4, active: true },
      ],
    },
    {
      posCode: 'COMPTABLE',
      components: [
        { type: 'GAIN',      label: 'Prime de responsabilite', code: 'PRIME_RESP',   amount: 200000, isPercent: false, order: 1, active: true },
        { type: 'GAIN',      label: 'Indemnite de transport',  code: 'INDMN_TRANSP', amount: 100000, isPercent: false, order: 2, active: true },
        { type: 'DEDUCTION', label: 'Cotisation CNAPS (13%)',  code: 'CNAPS',        amount: 13,     isPercent: true,  order: 3, active: true },
        { type: 'DEDUCTION', label: 'IRSA',                    code: 'IRSA',         amount: 25000,  isPercent: false, order: 4, active: true },
      ],
    },
    {
      posCode: 'TRESORIER',
      components: [
        { type: 'GAIN',      label: 'Prime de responsabilite', code: 'PRIME_RESP',   amount: 350000, isPercent: false, order: 1, active: true },
        { type: 'GAIN',      label: 'Indemnite de transport',  code: 'INDMN_TRANSP', amount: 120000, isPercent: false, order: 2, active: true },
        { type: 'DEDUCTION', label: 'Cotisation CNAPS (13%)',  code: 'CNAPS',        amount: 13,     isPercent: true,  order: 3, active: true },
        { type: 'DEDUCTION', label: 'IRSA',                    code: 'IRSA',         amount: 40000,  isPercent: false, order: 4, active: true },
      ],
    },
  ];

  for (const gd of gridDefs) {
    const pos = positions[gd.posCode];
    if (!pos) continue;
    const existing = await prisma.hrSalaryGrid.findUnique({ where: { positionId: pos.id } });
    if (!existing) {
      await prisma.hrSalaryGrid.create({
        data: {
          positionId: pos.id,
          currency: 'MGA',
          components: { create: gd.components },
        },
      });
    }
  }
  console.log('  OK  Salary Grids');

  // ── HR: Leave Types ───────────────────────────────────────────────────────────
  const leaveTypes = [
    { code: 'CONGE_ANNUEL',    name: 'Conge annuel',              daysPerYear: 30,  paid: true  },
    { code: 'CONGE_MALADIE',   name: 'Conge maladie',             daysPerYear: 30,  paid: true  },
    { code: 'CONGE_MATERNITE', name: 'Conge maternite',           daysPerYear: 90,  paid: true  },
    { code: 'CONGE_PATERNITE', name: 'Conge paternite',           daysPerYear: 5,   paid: true  },
    { code: 'FORMATION',       name: 'Formation professionnelle', daysPerYear: 15,  paid: true  },
    { code: 'MISSION',         name: 'Mission officielle',        daysPerYear: null, paid: true },
    { code: 'SANS_SOLDE',      name: 'Conge sans solde',          daysPerYear: null, paid: false },
    { code: 'AUTORISATION',    name: 'Autorisation speciale',     daysPerYear: null, paid: true },
  ];
  for (const lt of leaveTypes) {
    await prisma.hrLeaveType.upsert({
      where: { code: lt.code },
      update: {},
      create: { code: lt.code, name: lt.name, daysPerYear: lt.daysPerYear, paid: lt.paid, active: true },
    });
  }
  console.log('  OK  Leave Types');

  // ── HR: Employees ─────────────────────────────────────────────────────────────
  const employeeData = [
    { num: 'EMP-0001', firstName: 'Jean-Baptiste', lastName: 'RAKOTO',            email: 'jb.rakoto@univ.mg',         phone: '+261340000101', posCode: 'RECTEUR',        deptCode: 'RECTORAT',     contract: 'CDI',      salary: 3500000, start: '2010-01-15' },
    { num: 'EMP-0002', firstName: 'Claudine',       lastName: 'RASOAMAMPIONONA',  email: 'c.raso@univ.mg',            phone: '+261340000202', posCode: 'DIR_ADMIN',      deptCode: 'ADMIN',        contract: 'CDI',      salary: 2500000, start: '2012-03-01' },
    { num: 'EMP-0003', firstName: 'Hery',           lastName: 'ANDRIAMANALINA',   email: 'h.andria@univ.mg',          phone: '+261330000303', posCode: 'PROF_TITULAIRE', deptCode: 'INFORMATIQUE', contract: 'CDI',      salary: 2200000, start: '2015-09-01' },
    { num: 'EMP-0004', firstName: 'Fifaliana',      lastName: 'RATSIMBAZAFY',     email: 'f.ratsi@univ.mg',           phone: '+261320000404', posCode: 'MAITRE_CONF',    deptCode: 'INFORMATIQUE', contract: 'CDI',      salary: 1800000, start: '2018-10-01' },
    { num: 'EMP-0005', firstName: 'Tantely',        lastName: 'RANDRIANARISON',   email: 't.randy@univ.mg',           phone: '+261340000505', posCode: 'ASSISTANT',      deptCode: 'INFORMATIQUE', contract: 'CDD',      salary: 1200000, start: '2022-01-10', end: '2026-12-31' },
    { num: 'EMP-0006', firstName: 'Mirana',         lastName: 'RAKOTONDRABE',     email: 'm.rako@univ.mg',            phone: '+261330000606', posCode: 'VACATAIRE',      deptCode: 'INFORMATIQUE', contract: 'VACATAIRE',salary: 600000,  start: '2023-10-01' },
    { num: 'EMP-0007', firstName: 'Lanto',          lastName: 'ANDRIANTSOA',      email: 'l.andry@univ.mg',           phone: '+261320000707', posCode: 'CHEF_SCOL',      deptCode: 'SCOLARITE',    contract: 'CDI',      salary: 1500000, start: '2014-06-01' },
    { num: 'EMP-0008', firstName: 'Haingo',         lastName: 'RAKOTOARISON',     email: 'h.rakot@univ.mg',           phone: '+261340000808', posCode: 'SECRETAIRE',     deptCode: 'SCOLARITE',    contract: 'CDI',      salary: 900000,  start: '2019-07-15' },
    { num: 'EMP-0009', firstName: 'Rija',           lastName: 'RANDRIAMIHAJA',    email: 'r.rija@univ.mg',            phone: '+261330000909', posCode: 'TRESORIER',      deptCode: 'COMPTA',       contract: 'CDI',      salary: 2000000, start: '2016-04-01' },
    { num: 'EMP-0010', firstName: 'Anja',           lastName: 'RABEMANANJARA',    email: 'a.rabe@univ.mg',            phone: '+261320001010', posCode: 'COMPTABLE',      deptCode: 'COMPTA',       contract: 'CDI',      salary: 1400000, start: '2020-01-06' },
  ];

  for (const e of employeeData) {
    const existing = await prisma.hrEmployee.findUnique({ where: { employeeNumber: e.num } });
    if (!existing) {
      const emp = await prisma.hrEmployee.create({
        data: {
          employeeNumber: e.num,
          firstName: e.firstName,
          lastName: e.lastName,
          email: e.email,
          phone: e.phone,
          positionId: positions[e.posCode]?.id ?? null,
          departmentId: depts[e.deptCode]?.id ?? null,
          contractType: e.contract,
          baseSalary: e.salary,
          currency: 'MGA',
          startDate: new Date(e.start),
          endDate: e.end ? new Date(e.end) : null,
          active: true,
        },
      });
      await prisma.hrContract.create({
        data: {
          employeeId: emp.id,
          type: e.contract,
          startDate: new Date(e.start),
          endDate: e.end ? new Date(e.end) : null,
          baseSalary: e.salary,
          currency: 'MGA',
        },
      });
    }
  }
  console.log('  OK  Employees & Contracts (10 employees)');

  console.log('\nSeed completed!');
  console.log('Finance: currencies, categories, fee types, payment methods,');
  console.log('         penalties, discounts, scholarships, accounting accounts,');
  console.log('         cash registers, fiscal years.');
  console.log('HR:      departments, positions, salary grids, leave types,');
  console.log('         10 employees with contracts.');
}

main()
  .catch(e => { console.error('Seed error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
