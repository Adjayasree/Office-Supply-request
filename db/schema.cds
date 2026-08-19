namespace office.supply;

using { managed, cuid } from '@sap/cds/common';

entity Products {
  key ID             : String(10);
      name           : String(100);
      category       : String(50);
      unit           : String(20);
      availableStock : Integer;
}

entity RequestHeaders : cuid, managed {
  employeeName    : String(100);
  department      : String(60);
  reason          : String(255);
  status          : String(20) enum {
                      NEW;
                      APPROVED;
                      REJECTED;
                    } default 'NEW';
  rejectionReason : String(255);
  items           : Composition of many RequestItems on items.parent = $self;
}
  
entity RequestItems {
  key ID   : UUID;
  parent   : Association to RequestHeaders;
  product  : Association to Products;
  quantity : Integer;
}