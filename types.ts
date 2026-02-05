
export enum UserRole {
  ADMIN = 'ADMIN',
  ORGANIZER = 'ORGANIZER',
  USER = 'USER'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export enum SeatStatus {
  AVAILABLE = 'AVAILABLE',
  BOOKING_IN_PROGRESS = 'BOOKING_IN_PROGRESS',
  HELD = 'HELD',
  SOLD = 'SOLD',
  SELECTED = 'SELECTED',
  UNAVAILABLE = 'UNAVAILABLE' // Added for seats not assigned to a ticket type
}

// Deprecated for usage, kept for type compatibility with existing seeds if needed
export enum SeatTier {
  STANDARD = 'STANDARD',
  VIP = 'VIP',
  PREMIUM = 'PREMIUM'
}

export enum EventCategory {
  CONCERT = 'CONCERT',
  THEATER = 'THEATER',
  SPORTS = 'SPORTS',
  CONFERENCE = 'CONFERENCE',
  OTHER = 'OTHER'
}

export enum SeatingType {
  RESERVED = 'RESERVED',
  GENERAL_ADMISSION = 'GENERAL_ADMISSION'
}

export enum EventStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED'
}

export interface Seat {
  id: string; 
  row: number; 
  col: number; 
  rowLabel: string; 
  seatNumber: string; 
  status: SeatStatus;
  
  // Dynamic properties assigned by Event/Organizer
  tier?: string; // Changed from enum to string to support custom names
  price?: number; 
  color?: string; // Visual color for the seat
  ticketTypeId?: string; // Reference to the specific ticket type definition
}

export interface Stage {
  label: string;
  x: number; 
  y: number; 
  width: number; 
  height: number; 
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  capacity?: number;
}

export interface Theater {
  id: string;
  name: string;
  venueId: string;
  seats: Seat[]; 
  rows: number; 
  cols: number; 
  stage: Stage;
}

export interface TicketType {
  id: string;
  name: string;
  price: number;
  color: string; // Hex or tailwind class
  description?: string;
  // For General Admission
  totalQuantity?: number;
  sold?: number;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  organizerId: string;
  
  startTime: string; 
  endTime: string; 
  timezone: string;
  
  venueId: string;
  theaterId?: string; // Made optional for GA events
  
  imageUrl: string; 
  category: EventCategory;
  status: EventStatus;
  seatingType: SeatingType;
  currency: string;
  terms: string;
  
  // Soft Delete Flag
  deleted?: boolean;

  // New Ticket Definition
  ticketTypes: TicketType[];

  seats: Seat[]; 
  stage?: Stage; 
  rows?: number;
  cols?: number;
  location?: string; 
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  value: number;
  eventId: string | null; // If null, applies to all events by organizer
  // New rule-driven fields
  ruleType?: 'THRESHOLD' | 'SEAT_COUNT' | 'CODE';
  // Explicit rule fields (preferred over legacy ruleParams)
  minAmount?: number; // for THRESHOLD
  minSeats?: number; // for SEAT_COUNT
  ruleParams?: any;
  // Backend may return a computed discount during validation
  discount?: number;
  organizerId: string;
  maxUses: number;
  usedCount: number;
  expiryDate: string;
  active: boolean;
  deleted?: boolean;
}

export interface ServiceCharge {
  id: string;
  name: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  active: boolean;
}

export interface Ticket {
  id: string;
  eventId: string;
  eventTitle: string;
  seatId: string;
  seatLabel: string;
  price: number;
  ticketType?: string;
  color?: string;
  qrCodeData: string;
  purchaseDate: string;
  checkedIn?: boolean;
  checkInDate?: string;
}

export enum PaymentMode {
  ONLINE = 'ONLINE',
  CASH = 'CASH',
  CHARITY = 'CHARITY'
}

export interface Order {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  tickets: Ticket[];
  totalAmount: number;
  serviceFee: number; // Platform fee charged
  discountApplied: number;
  couponCode?: string;
  status: 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  refundAmount?: number;
  refundStatus?: 'PENDING' | 'PROCESSED' | 'FAILED';
  cancellationNotes?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  paymentMode: PaymentMode;
  date: string;
}
