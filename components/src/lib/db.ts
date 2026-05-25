import Dexie, { type Table } from 'dexie';
import { Order, Settings, Wallet, Treasury, CustomerProfile } from '../../types';

export class AppDatabase extends Dexie {
  orders!: Table<Order>;
  settings!: Table<Settings>;
  wallet!: Table<Wallet>;
  treasury!: Table<Treasury>;
  customers!: Table<CustomerProfile>;

  constructor() {
    super('SmartOrderManagerDB');
    this.version(1).stores({
      orders: 'id, orderNumber, date, status, customerPhone',
      settings: 'id', // We'll use a fixed ID for global settings if needed, or store per-store
      wallet: 'id',
      treasury: 'id',
      customers: 'id, phone, name',
    });
  }
}

export const db = new AppDatabase();
