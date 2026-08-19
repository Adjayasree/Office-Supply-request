sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/TextArea",
    "sap/m/Label"
], function (Controller, JSONModel, MessageToast, MessageBox, Dialog, Button, TextArea, Label) {
    "use strict";

    return Controller.extend("office.supply.app.controller.Main", {

        onInit: function () {
            var oCartData = { items: [] };
            var oCartModel = new JSONModel(oCartData);
            this.getView().setModel(oCartModel, "cartModel");
        },

        // FORMATTER: Counts items for total badge
        formatItemCount: function (aItems) {
            if (!aItems) {
                return 0;
            }
            if (Array.isArray(aItems)) {
                return aItems.length;
            }
            if (typeof aItems === "object" && aItems.__deferred) {
                return 0;
            }
            return 0;
        },

        // FORMATTER: Reads expanded product names & quantities to display as a string
        formatItemDetails: function (aItems) {
            console.log("Items received in formatter:", aItems);
            if (!aItems || !Array.isArray(aItems) || aItems.length === 0) {
                return "No items";
            }

            return aItems.map(function (item) {
                var sProductName = (item.product && item.product.name) || item.name || item.product_ID || "Unknown Item";
                return sProductName + " (x" + item.quantity + ")";
            }).join(", ");
        },

        getItemCount: function (aItems) {
            if (Array.isArray(aItems)) {
                return aItems.length;
            }
            return 0;
        },

        onAddToCart: function (oEvent) {
            var oItem = oEvent.getSource().getBindingContext().getObject();
            var oCartModel = this.getView().getModel("cartModel");
            var aItems = oCartModel.getProperty("/items");

            var bExists = aItems.some(function (cartItem) {
                return cartItem.product_ID === oItem.ID;
            });

            if (bExists) {
                MessageBox.warning("Product '" + oItem.name + "' is already in your cart.");
                return;
            }

            if (aItems.length >= 5) {
                MessageBox.error("A request cannot contain more than 5 distinct products.");
                return;
            }

            aItems.push({
                product_ID: oItem.ID,
                name: oItem.name,
                quantity: 1
            });

            oCartModel.setProperty("/items", aItems);
            MessageToast.show("Added " + oItem.name + " to cart.");
        },

        onRemoveFromCart: function (oEvent) {
            var oItemContext = oEvent.getSource().getBindingContext("cartModel");
            var iIndex = parseInt(oItemContext.getPath().split("/").pop(), 10);
            var oCartModel = this.getView().getModel("cartModel");
            var aItems = oCartModel.getProperty("/items");
            aItems.splice(iIndex, 1);
            oCartModel.setProperty("/items", aItems);
        },

        onClearCart: function () {
            var oCartModel = this.getView().getModel("cartModel");
            oCartModel.setProperty("/items", []);
            this.byId("empName").setValue("");
            this.byId("empDept").setValue("");
            this.byId("reqReason").setValue("");
        },

       onSubmitCartRequest: function () {
    var sEmpName = this.byId("empName").getValue();
    var sEmpDept = this.byId("empDept").getValue();
    var sReason = this.byId("reqReason").getValue();
    var oCartModel = this.getView().getModel("cartModel");
    var aCartItems = oCartModel.getProperty("/items");

    if (!sEmpName || !sEmpDept || !sReason) {
        MessageBox.error("Please fill in Employee Name, Department, and Reason.");
        return;
    }

    if (aCartItems.length === 0) {
        MessageBox.error("Your cart is empty! Please add at least 1 product.");
        return;
    }

    // FIXED PAYLOAD: Send 'product' association object instead of raw product_ID
    var aPayloadItems = aCartItems.map(function (item) {
        return {
            product: { ID: item.product_ID }, // <--- THIS LINKS THE PRODUCT ASSOCIATION
            quantity: parseInt(item.quantity, 10)
        };
    });

    var oModel = this.getView().getModel();
    var oListBinding = oModel.bindList("/RequestHeaders");

    var oContext = oListBinding.create({
        employeeName: sEmpName,
        department: sEmpDept,
        reason: sReason,
        items: aPayloadItems
    });

    oContext.created().then(() => {
        MessageToast.show("Request submitted successfully!");
        this.onClearCart();
        this.byId("iconTabBar").setSelectedKey("admin");
        
        var oRequestTable = this.byId("requestTable");
        if (oRequestTable && oRequestTable.getBinding("items")) {
            oRequestTable.getBinding("items").refresh();
        }
    }).catch((oError) => {
        MessageBox.error("Error submitting request: " + (oError.message || "Submission failed"));
    });
},

        onApprove: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var sRequestId = oContext.getProperty("ID");
            var oModel = this.getView().getModel();

            MessageBox.confirm("Are you sure you want to approve this request?", {
                onClose: (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        var oOperation = oModel.bindContext("/approveRequest(...)");
                        oOperation.setParameter("requestID", sRequestId);

                        oOperation.execute().then(() => {
                            MessageToast.show("Request Approved!");
                            this.byId("requestTable").getBinding("items").refresh();
                        }).catch((oError) => {
                            MessageBox.error(oError.message);
                        });
                    }
                }
            });
        },

        onOpenRejectDialog: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var sRequestId = oContext.getProperty("ID");
            var oModel = this.getView().getModel();

            var oTextArea = new TextArea({
                width: "100%",
                rows: 3,
                placeholder: "Enter mandatory rejection reason..."
            });

            var oDialog = new Dialog({
                title: "Reject Request",
                type: "Message",
                content: [
                    new Label({ text: "Rejection Reason:", required: true }),
                    oTextArea
                ],
                beginButton: new Button({
                    text: "Confirm Rejection",
                    type: "Reject",
                    press: () => {
                        var sReason = oTextArea.getValue();
                        if (!sReason || sReason.trim() === "") {
                            MessageBox.error("Rejection reason is mandatory!");
                            return;
                        }

                        var oOperation = oModel.bindContext("/rejectRequest(...)");
                        oOperation.setParameter("requestID", sRequestId);
                        oOperation.setParameter("rejectionReason", sReason);

                        oOperation.execute().then(() => {
                            MessageToast.show("Request Rejected.");
                            oDialog.close();
                            this.byId("requestTable").getBinding("items").refresh();
                        }).catch((oError) => {
                            MessageBox.error(oError.message);
                        });
                    }
                }),
                endButton: new Button({
                    text: "Cancel",
                    press: function () {
                        oDialog.close();
                    }
                }),
                afterClose: function () {
                    oDialog.destroy();
                }
            });

            oDialog.open();
        }

    });
});