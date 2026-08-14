sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("office.supply.app.controller.Main", {

        onInit: function () {
            this._selectedProductID = null;
        },

        // 1. Triggered when clicking "Request" button on a product row
        onOpenRequestForm: function (oEvent) {
            var oItem = oEvent.getSource().getBindingContext().getObject();
            this._selectedProductID = oItem.ID;

            // Populate the Selected Product field
            this.byId("reqProdName").setValue(oItem.name + " (" + oItem.ID + ")");

            // Directly switch to the 'create' tab using setSelectedKey
            this.byId("iconTabBar").setSelectedKey("create");

            MessageToast.show("Selected: " + oItem.name);
        },

        // 2. Triggered when clicking "Submit Request" in Tab 2
        onSubmitRequest: function () {
            var sEmpName = this.byId("empName").getValue();
            var iQuantity = parseInt(this.byId("reqQuantity").getValue(), 10);
            var sReason = this.byId("reqReason").getValue();

            if (!this._selectedProductID) {
                MessageBox.error("Please select a product from the Products List tab first!");
                return;
            }

            if (!sEmpName || !sReason) {
                MessageBox.error("Please fill in all required fields (Employee Name and Reason).");
                return;
            }

            var oModel = this.getView().getModel();
            var oListBinding = oModel.bindList("/SupplyRequests");

            oListBinding.create({
                product_ID: this._selectedProductID,
                employeeName: sEmpName,
                quantity: iQuantity,
                reason: sReason,
                status: "NEW"
            }).created().then(function () {
                MessageToast.show("Supply Request submitted successfully!");
                this.onCancelRequest();
                
                // Switch to Admin tab to see the created request
                this.byId("iconTabBar").setSelectedKey("admin");
                oModel.refresh();
            }.bind(this)).catch(function (oError) {
                MessageBox.error("Error submitting request: " + oError.message);
            });
        },

        // 3. Triggered when clicking "Cancel"
        onCancelRequest: function () {
            this._selectedProductID = null;
            this.byId("reqProdName").setValue("");
            this.byId("empName").setValue("");
            this.byId("reqQuantity").setValue(1);
            this.byId("reqReason").setValue("");
            this.byId("iconTabBar").setSelectedKey("products");
        },

        // 4. Admin Approve
        onApprove: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var sRequestId = oContext.getProperty("ID");
            var oModel = this.getView().getModel();

            var oOperation = oModel.bindContext("/approveRequest(...)");
            oOperation.setParameter("requestID", sRequestId);

            oOperation.execute().then(function () {
                MessageToast.show("Request Approved!");
                oModel.refresh();
            }).catch(function (oError) {
                MessageBox.error("Error approving request: " + oError.message);
            });
        },

        // 5. Admin Reject
        onReject: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var sRequestId = oContext.getProperty("ID");
            var oModel = this.getView().getModel();

            var oOperation = oModel.bindContext("/rejectRequest(...)");
            oOperation.setParameter("requestID", sRequestId);

            oOperation.execute().then(function () {
                MessageToast.show("Request Rejected.");
                oModel.refresh();
            }).catch(function (oError) {
                MessageBox.error("Error rejecting request: " + oError.message);
            });
        }

    });
});