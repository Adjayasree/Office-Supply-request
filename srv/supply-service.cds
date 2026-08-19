using {office.supply as my} from '../db/schema';

service SupplyService {
  entity Products as projection on my.Products;
  entity RequestHeaders as projection on my.RequestHeaders;
  entity RequestItems as projection on my.RequestItems {
        *,
        product : redirected to Products
    };

  action approveRequest(requestID: UUID) returns String;
  action rejectRequest(requestID: UUID, rejectionReason: String) returns String;

}