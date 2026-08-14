namespace office.supply;

using { managed, cuid } from '@sap/cds/common';

entity Products {
  key ID             : String(10);
      name           : String(100);
      category       : String(50);
      unit           : String(20);
      availableStock : Integer;
}

entity SupplyRequests : cuid, managed {
  employeeName : String(100);
  product      : Association to Products;
  quantity     : Integer;
  reason       : String(255);
  status       : String enum {
    NEW;
    APPROVED;
    REJECTED;
  } default 'NEW';
}