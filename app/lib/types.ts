export type PaymentStatus = "pending" | "successful" | "failed" | "cancelled" | "refunded";

export type FulfilmentStatus =
  | "draft"
  | "pending_payment"
  | "paid"
  | "awaiting_books"
  | "allocated_to_distributor"
  | "books_dispatched"
  | "in_transit"
  | "received_by_distributor"
  | "ready_for_fulfilment"
  | "out_for_delivery"
  | "delivered"
  | "delivery_issue"
  | "address_issue"
  | "distributor_issue"
  | "missing_books"
  | "damaged_books";

export interface Distributor {
  id: string;
  name: string;
  business_name: string | null;
  country: string;
  state_region: string | null;
  city: string | null;
  status: "active" | "temporarily_unavailable" | "inactive" | "pending_review";
}

export interface ParentInfo {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  whatsapp_number: string;
  country: string;
  state_region: string;
  city: string;
  delivery_address: string;
  postal_code?: string;
  delivery_instructions?: string;
}

export interface DraftOrder {
  quantity: number;
  parent: ParentInfo;
  distributor: Distributor | null;
}

export const UNIT_PRICE = 49500;
