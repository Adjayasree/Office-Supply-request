const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
  const { Products, SupplyRequests } = this.entities;

  // Validation: Mandatory backend checks upon creation
  this.before('CREATE', 'SupplyRequests', async (req) => {
    const { product_ID, quantity } = req.data;

    // Rule 1: Quantity > 0
    if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      return req.error(400, 'Quantity must be a whole number greater than zero.');
    }

    // Rule 2: Product existence
    const product = await SELECT.one.from(Products).where({ ID: product_ID });
    if (!product) {
      return req.error(404, 'The selected product does not exist.');
    }
  });

  // Action: approveRequest
  this.on('approveRequest', async (req) => {
    const { requestID } = req.data;

    // Start single transaction
    return cds.transaction(req).run(async (tx) => {
      // 1. Fetch Request
      const request = await tx.run(SELECT.one.from(SupplyRequests).where({ ID: requestID }));
      if (!request) return req.error(404, 'Request not found.');

      // Rule 3 & 4: Only NEW requests can be approved/rejected
      if (request.status !== 'NEW') {
        return req.error(400, `Request is already ${request.status}. Cannot approve twice.`);
      }

      // 2. Fetch latest stock
      const product = await tx.run(SELECT.one.from(Products).where({ ID: request.product_ID }));

      // Rule 5 & 7: Check stock availability
      if (!product || product.availableStock < request.quantity) {
        return req.error(400, `Insufficient stock! Requested: ${request.quantity}, Available: ${product ? product.availableStock : 0}.`);
      }

      // Rule 6: Update stock and status together
      await tx.run(UPDATE(Products).set({ availableStock: product.availableStock - request.quantity }).where({ ID: product.product_ID || product.ID }));
      await tx.run(UPDATE(SupplyRequests).set({ status: 'APPROVED' }).where({ ID: requestID }));

      return 'Request APPROVED successfully!';
    });
  });

  // Action: rejectRequest
  this.on('rejectRequest', async (req) => {
    const { requestID } = req.data;

    const request = await SELECT.one.from(SupplyRequests).where({ ID: requestID });
    if (!request) return req.error(404, 'Request not found.');

    if (request.status !== 'NEW') {
      return req.error(400, `Request is already ${request.status}.`);
    }

    // Rule 8: Rejection updates status without changing stock
    await UPDATE(SupplyRequests).set({ status: 'REJECTED' }).where({ ID: requestID });
    return 'Request REJECTED.';
  });
});