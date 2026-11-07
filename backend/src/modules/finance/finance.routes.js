import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.js'
import { requirePermission } from '../../middlewares/rbac.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import * as svc from './finance.service.js'

const r = Router()
r.use(authenticate)

// Fee Structures
r.get('/fees',                  requirePermission('VIEW_FINANCE'), asyncHandler(svc.listFees))
r.post('/fees',                 requirePermission('CREATE_FEE'), asyncHandler(svc.createFee))
r.put('/fees/:id',              requirePermission('CREATE_FEE'), asyncHandler(svc.updateFee))

// Invoices
r.get('/invoices',              requirePermission('VIEW_FINANCE'), asyncHandler(svc.listInvoices))
r.get('/invoices/my',           asyncHandler(svc.myInvoices))
r.get('/invoices/:id',          asyncHandler(svc.getInvoice))
r.post('/invoices',             requirePermission('CREATE_INVOICE'), asyncHandler(svc.createInvoice))
r.post('/invoices/bulk',        requirePermission('CREATE_INVOICE'), asyncHandler(svc.bulkCreateInvoices))

// Payments
r.get('/payments',              requirePermission('VIEW_FINANCE'), asyncHandler(svc.listPayments))
r.post('/payments',             requirePermission('RECORD_PAYMENT'), asyncHandler(svc.recordPayment))
r.put('/payments/:id/validate', requirePermission('VALIDATE_PAYMENT'), asyncHandler(svc.validatePayment))
r.put('/payments/:id/cancel',   requirePermission('CANCEL_PAYMENT'), asyncHandler(svc.cancelPayment))

// Reports
r.get('/summary',               requirePermission('VIEW_FINANCE'), asyncHandler(svc.financeSummary))

export default r
