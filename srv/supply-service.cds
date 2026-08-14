using office.supply as my from '../db/schema';

service SupplyService {
  entity Products as projection on my.Products;
  entity SupplyRequests as projection on my.SupplyRequests;

  action approveRequest(requestID: UUID) returns String;
  action rejectRequest(requestID: UUID) returns String;
}