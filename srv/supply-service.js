const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
    const { Products, RequestHeaders, RequestItems } = this.entities;

    // -------------------------------------------------------------
    // 1. BEFORE CREATE: Validate Deep-Create Payload
    // -------------------------------------------------------------
    this.before('CREATE', 'RequestHeaders', async (req) => {
        const { employeeName, department, reason, items } = req.data;

        // Force initial status to NEW regardless of what client sends
        req.data.status = 'NEW';

        // Rule: Required Header Fields
        if (!employeeName || !department || !reason) {
            return req.error(400, 'Employee Name, Department, and Reason are mandatory.');
        }

        // Rule: 1 to 5 Items constraint
        if (!items || items.length === 0) {
            return req.error(400, 'A request must contain at least 1 item.');
        }
        if (items.length > 5) {
            return req.error(400, 'A request cannot contain more than 5 items.');
        }

        const productIds = new Set();

        for (const item of items) {
            // Rule: Valid positive integer quantities
            if (!item.quantity || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
                return req.error(400, `Invalid quantity for product ${item.product_ID}. Quantity must be a whole number greater than 0.`);
            }

            // Rule: Prevent Duplicate Products in single request
            if (productIds.has(item.product_ID)) {
                return req.error(400, `Duplicate product ${item.product_ID} detected in request.`);
            }
            productIds.add(item.product_ID);

            // Rule: Verify product existence
            const dbProduct = await SELECT.one.from(Products).where({ ID: item.product_ID });
            if (!dbProduct) {
                return req.error(404, `Product ${item.product_ID} does not exist.`);
            }
        }
    });

    // -------------------------------------------------------------
    // 2. ACTION: Approve Request (All-or-Nothing Transaction)
    // -------------------------------------------------------------
    this.on('approveRequest', async (req) => {
        const { requestID } = req.data;

        // Fetch Header with items and product details
        const header = await SELECT.one.from(RequestHeaders)
            .where({ ID: requestID })
            .columns(h => {
                h.status,
                h.items(i => {
                    i.quantity,
                    i.product_ID
                })
            });

        if (!header) return req.error(404, `Request ${requestID} not found.`);
        if (header.status !== 'NEW') {
            return req.error(400, `Only requests with status 'NEW' can be approved. Current status: ${header.status}`);
        }

        // Mandatory Stock Check (All-or-Nothing)
        for (const item of header.items) {
            const product = await SELECT.one.from(Products).where({ ID: item.product_ID });
            if (!product || product.availableStock < item.quantity) {
                return req.error(400, `Approval failed: Insufficient stock for product '${product ? product.name : item.product_ID}'. Required: ${item.quantity}, Available: ${product ? product.availableStock : 0}.`);
            }
        }

        // Atomic Update across all products & header status
        return cds.tx(req).run(async (tx) => {
            for (const item of header.items) {
                await tx.update(Products)
                    .set({ availableStock: { '-=': item.quantity } })
                    .where({ ID: item.product_ID });
            }

            await tx.update(RequestHeaders)
                .set({ status: 'APPROVED' })
                .where({ ID: requestID });

            return 'Request approved successfully and inventory updated.';
        });
    });

    // -------------------------------------------------------------
    // 3. ACTION: Reject Request
    // -------------------------------------------------------------
    this.on('rejectRequest', async (req) => {
        const { requestID, rejectionReason } = req.data;

        if (!rejectionReason || rejectionReason.trim() === '') {
            return req.error(400, 'Rejection reason is mandatory.');
        }

        const header = await SELECT.one.from(RequestHeaders).where({ ID: requestID });
        if (!header) return req.error(404, `Request ${requestID} not found.`);
        if (header.status !== 'NEW') {
            return req.error(400, `Only requests with status 'NEW' can be rejected.`);
        }

        await UPDATE(RequestHeaders)
            .set({ status: 'REJECTED', rejectionReason: rejectionReason })
            .where({ ID: requestID });

        return 'Request rejected successfully.';
    });
});